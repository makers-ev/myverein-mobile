import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { isNotFound, parseDayKey, privacyErrorKeyOr } from '@/lib/ward';
import { useAbsences, type Absence, type AbsenceInput, type AbsenceSubject } from '@/hooks/useAbsences';
import AbsenceSheet from './AbsenceSheet';

interface Props {
  subject: AbsenceSubject;
  /** First name of the child for a guardian report; null for the own report. */
  wardName?: string | null;
  /** Guardian link right `can_report_absence`; the own report is always allowed (the backend decides). */
  canReport?: boolean;
  /** A child's link ended (404 on the ward route): the screen reloads the wards. */
  onGone?: () => void;
}

/**
 * Sick note / absence quick action for one person (Wave 10 M2): button -> sheet -> saved, plus the upcoming reports with
 * "Zurückziehen". Used for the own report (Profil tab) and per child ("Heute"). Hides itself for a 403/404 on the own
 * report (external guest without membership). The note text is shown to the person who wrote it, never logged.
 */
export default function AbsenceSection({ subject, wardName = null, canReport = true, onGone }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { absences, loading, error, reload, create, withdraw } = useAbsences(subject);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const gone = subject.kind === 'ward' && isNotFound(error);
  useEffect(() => {
    if (gone) onGone?.();
  }, [gone, error, onGone]);

  const status = (error as { status?: number } | null)?.status;
  if (subject.kind === 'self' && (status === 403 || status === 404) && absences.length === 0) return null;

  const day = (key: string) => parseDayKey(key).toLocaleDateString(language, { day: 'numeric', month: 'short' });
  const period = (a: Absence) => (a.startsOn === a.endsOn ? day(a.startsOn) : t('absence.period', { from: day(a.startsOn), to: day(a.endsOn) }));

  const submit = async (input: AbsenceInput) => {
    setSaving(true);
    setSheetError(null);
    const res = await create(input);
    setSaving(false);
    if (res.ok) {
      setSheetOpen(false);
      setNotice(wardName ? t('absence.sent-ward', { name: wardName }) : t('absence.sent'));
    } else {
      setSheetError(t(privacyErrorKeyOr(res.error, 'absence.error.generic')));
    }
  };

  const confirmWithdraw = (a: Absence) => {
    Alert.alert(t('absence.withdraw.title'), t('absence.withdraw.message'), [
      { text: t('ui.cancel'), style: 'cancel' },
      {
        text: t('absence.withdraw'),
        style: 'destructive',
        onPress: () =>
          void withdraw(a.id).then((res) => setNotice(res.ok ? t('absence.withdrawn') : t(privacyErrorKeyOr(res.error, 'absence.withdraw-failed')))),
      },
    ]);
  };

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-bold text-base mb-2">
        {t('absence.title')}
      </Text>
      {canReport ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={wardName ? t('absence.button-ward', { name: wardName }) : t('absence.button')}
          onPress={() => {
            setNotice(null);
            setSheetError(null);
            setSheetOpen(true);
          }}
          className="bg-primary dark:bg-primary-dark rounded-xl items-center justify-center"
          style={{ minHeight: 48 }}
        >
          <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold text-sm">
            {wardName ? t('absence.button-ward', { name: wardName }) : t('absence.button')}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('absence.read-only-ward')}</Text>
      )}

      {notice ? (
        <Text className="text-success dark:text-success-dark text-sm mt-3" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      {loading && absences.length === 0 && !error ? (
        <View className="mt-3">
          <ActivityIndicator color={themeColors.primary} />
        </View>
      ) : error && absences.length === 0 ? (
        <View className="mt-2">
          <Text className="text-destructive text-sm">{apiErrorMessage(error, t, 'absence.load-error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        absences.map((a) => (
          <View key={a.id} className="flex-row items-center border-t border-border dark:border-border-dark mt-3 pt-3" style={{ gap: 8 }}>
            <View className="flex-1">
              <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                {t(`absence.kind.${a.kind}`)} - {period(a)}
              </Text>
              {a.note ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{a.note}</Text> : null}
            </View>
            {canReport ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('absence.withdraw')}: ${t(`absence.kind.${a.kind}`)} - ${period(a)}`} onPress={() => confirmWithdraw(a)} className="justify-center" style={{ minHeight: 44 }}>
                <Text className="text-destructive text-sm font-semibold">{t('absence.withdraw')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}

      <AbsenceSheet visible={sheetOpen} wardName={wardName} saving={saving} error={sheetError} onClose={() => !saving && setSheetOpen(false)} onSubmit={(i) => void submit(i)} />
    </View>
  );
}
