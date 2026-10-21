import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { privacyErrorKeyOr } from '@/lib/ward';
import { consentActions, consentBadgeKey } from '@/lib/consentUi';
import { useConsents, type ConsentSubject, type ConsentView } from '@/hooks/useConsents';
import FormSheet from '@/components/ui/FormSheet';

interface Props {
  subject: ConsentSubject;
  /** First name of the child for a guardian view; null for the own consents. */
  wardName?: string | null;
  /** Called after a decision was saved (the Heute screen refreshes its "offen" badge). */
  onChanged?: () => void;
}

/**
 * Einwilligungen (Wave 10 M3) of one person: the club's consent purposes with the current state, the text of the version
 * to read, and confirm / decline / revoke. Strictly voluntary: nothing here blocks anything, and the copy says so; there
 * is no "Pflicht" anywhere. Used for the own consents (Profil tab) and per child ("Heute"). Hides itself for a 403/404 on
 * the own consents (no membership). A grant sends the version that was shown; if the text changed meanwhile the sheet
 * refreshes and asks again instead of recording a consent to a text the person never saw.
 */
export default function ConsentsSection({ subject, wardName = null, onChanged }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { consents, canDecide, loading, error, reload, grant, revoke } = useConsents(subject);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheetNotice, setSheetNotice] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = (error as { status?: number } | null)?.status;
  if (subject.kind === 'self' && (status === 403 || status === 404) && consents.length === 0) return null;

  const open = consents.find((c) => c.purposeId === openId) ?? null;
  const sorted = [...consents].sort((a, b) => Number(b.open) - Number(a.open));

  const openSheet = (c: ConsentView) => {
    setOpenId(c.purposeId);
    setSheetNotice(null);
    setSheetError(null);
  };

  const run = async (c: ConsentView, kind: 'grant' | 'revoke') => {
    setSaving(true);
    setSheetError(null);
    setSheetNotice(null);
    const res = await (kind === 'grant' ? grant(c) : revoke(c));
    setSaving(false);
    if (res.ok) {
      setOpenId(null);
      setNotice(
        kind === 'grant'
          ? t('consent.saved.granted', { name: c.name })
          : c.state === 'granted'
            ? t('consent.saved.revoked', { name: c.name })
            : t('consent.saved.declined', { name: c.name }),
      );
      onChanged?.();
    } else if (res.outdated) {
      // The list was refreshed in the hook: the sheet now shows the new text version.
      setSheetNotice(t('consent.outdated'));
    } else {
      setSheetError(t(privacyErrorKeyOr(res.error, 'consent.error.generic')));
    }
  };

  const confirmRevoke = (c: ConsentView) => {
    Alert.alert(t('consent.revoke.title'), t('consent.revoke.message'), [
      { text: t('ui.cancel'), style: 'cancel' },
      { text: t('consent.action.revoke'), style: 'destructive', onPress: () => void run(c, 'revoke') },
    ]);
  };

  const actions = open ? consentActions(open) : null;

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">
        {t('consent.title')}
      </Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{wardName ? t('consent.intro-ward', { name: wardName }) : t('consent.intro')}</Text>

      {notice ? (
        <Text className="text-success dark:text-success-dark text-sm mb-3" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      {loading && consents.length === 0 && !error ? (
        <ActivityIndicator color={themeColors.primary} />
      ) : error && consents.length === 0 ? (
        <View>
          <Text className="text-destructive text-sm">{apiErrorMessage(error, t, 'consent.load-error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : consents.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('consent.empty')}</Text>
      ) : (
        sorted.map((c) => (
          <TouchableOpacity
            key={c.purposeId}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}: ${t(consentBadgeKey(c))}`}
            onPress={() => openSheet(c)}
            className="flex-row items-center justify-between border-t border-border dark:border-border-dark py-3"
            style={{ minHeight: 48, gap: 8 }}
          >
            <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm font-semibold">{c.name}</Text>
            <View className={`rounded-full px-2 py-0.5 ${c.open || c.outdated ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'}`}>
              <Text className={`text-xs font-bold ${c.open || c.outdated ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}>
                {t(consentBadgeKey(c))}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      <FormSheet visible={!!open} title={open?.name ?? ''} onClose={() => !saving && setOpenId(null)} cancelLabel={t('consent.close')}>
        {open && actions ? (
          <View>
            {sheetNotice ? (
              <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold mb-3" accessibilityLiveRegion="polite">
                {sheetNotice}
              </Text>
            ) : null}
            {open.description ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{open.description}</Text> : null}
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">{t('consent.text-version', { version: open.text.version })}</Text>
            <ScrollView className="border border-border dark:border-border-dark rounded-xl p-3 mb-3" style={{ maxHeight: 260 }} nestedScrollEnabled>
              <Text selectable className="text-foreground dark:text-foreground-dark text-sm">
                {open.text.body}
              </Text>
            </ScrollView>
            <Text className="text-foreground dark:text-foreground-dark text-sm mb-1">
              {t(consentBadgeKey(open))}
              {open.decidedAt ? ` - ${new Date(open.decidedAt).toLocaleDateString(language)}` : ''}
              {open.outdated && open.recordedTextVersion ? ` (${t('consent.recorded-version', { version: open.recordedTextVersion })})` : ''}
            </Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('consent.voluntary')}</Text>

            {canDecide ? (
              <View style={{ gap: 8 }}>
                {actions.grant ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => void run(open, 'grant')}
                    className={`bg-primary dark:bg-primary-dark rounded-xl items-center justify-center ${saving ? 'opacity-50' : ''}`}
                    style={{ minHeight: 48 }}
                  >
                    {saving ? (
                      <ActivityIndicator color={themeColors.primaryForeground} />
                    ) : (
                      <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold text-sm">{t(actions.grant)}</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                {actions.decline ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => (open.state === 'granted' ? confirmRevoke(open) : void run(open, 'revoke'))}
                    className={`border border-border dark:border-border-dark rounded-xl items-center justify-center ${saving ? 'opacity-50' : ''}`}
                    style={{ minHeight: 48 }}
                  >
                    <Text className={`font-semibold text-sm ${open.state === 'granted' ? 'text-destructive' : 'text-foreground dark:text-foreground-dark'}`}>{t(actions.decline)}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('consent.read-only', { name: wardName ?? '' })}</Text>
            )}
            {sheetError ? (
              <Text className="text-destructive text-sm mt-3" accessibilityRole="alert">
                {sheetError}
              </Text>
            ) : null}
          </View>
        ) : null}
      </FormSheet>
    </View>
  );
}
