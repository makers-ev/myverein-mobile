import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { exitErrorCode, formatDay, useMyExitRequests, type ExitPreview } from '@/hooks/useExitRequests';
import DateTimeField, { toDateString } from '@/components/ui/DateTimeField';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';

function noticeHint(preview: ExitPreview | null, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (!preview || (preview.noticePeriodDays === null && preview.noticeMode === null)) return t('exit.notice.none');
  const date = formatDay(preview.earliestEffectiveOn);
  const mode = preview.noticeMode ? t(`exit.mode.${preview.noticeMode}`) : '';
  if (preview.noticePeriodDays !== null && preview.noticeMode) return t('exit.notice.hint', { days: preview.noticePeriodDays, mode, date });
  if (preview.noticePeriodDays !== null) return t('exit.notice.hint-days', { days: preview.noticePeriodDays, date });
  return t('exit.notice.hint-mode', { mode, date });
}

/**
 * "Mitgliedschaft" card in the Profil tab: notice-period hint, file a
 * cancellation (`POST /club-exit-requests`), see its status and withdraw it.
 * The owner of the club cannot cancel (backend: 409 `owner_protected`), so the
 * action is replaced by a message for them.
 */
export default function ExitRequestSection({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { activeClub } = useActiveClub();
  const { requests, preview, loaded, loading, error, refetch, submit, withdraw } = useMyExitRequests(clubId);

  const [ownerBlocked, setOwnerBlocked] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [desired, setDesired] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const isOwner = ownerBlocked || (activeClub?.clubId === clubId && (activeClub.orgRole ?? '').split(',').map((r) => r.trim()).includes('owner'));
  const today = toDateString(new Date());
  const pending = requests.find((r) => r.status === 'pending' && r.kind === 'cancellation');
  const scheduled = requests.find((r) => r.status === 'approved' && r.kind === 'cancellation' && r.effectiveOn !== null && r.effectiveOn > today);
  const active = pending ?? scheduled ?? null;
  const lastRejected = !active && requests[0]?.status === 'rejected' && requests[0].kind === 'cancellation' ? requests[0] : null;

  const mapError = (err: unknown): string => {
    const code = exitErrorCode(err);
    if (code === 'exit_request_pending') return t('exit.error.pending');
    if (code === 'exit_already_scheduled') return t('exit.error.scheduled');
    return err instanceof ApiError ? err.message : t('alert.general-error-description');
  };

  const openSheet = () => {
    setDesired(null);
    setReason('');
    setSheetError(null);
    setNotice(null);
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    setSheetError(null);
    try {
      const created = await submit({ desiredEffectiveOn: desired ? toDateString(desired) : null, reason });
      setSheetOpen(false);
      setNotice(
        created.adjustedToEarliest
          ? `${t('exit.submitted')} ${t('exit.adjusted', { date: formatDay(created.earliestEffectiveOn) })}`
          : t('exit.submitted'),
      );
    } catch (err) {
      if (exitErrorCode(err) === 'owner_protected') {
        setOwnerBlocked(true);
        setSheetOpen(false);
      } else {
        setSheetError(mapError(err));
        if (exitErrorCode(err)) {
          setSheetOpen(false);
          setActionError(mapError(err));
          void refetch();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmWithdraw = () => {
    if (!active) return;
    Alert.alert(t('exit.withdraw.title'), t('exit.withdraw.message'), [
      { text: t('exit.cancel'), style: 'cancel' },
      {
        text: t('exit.withdraw'),
        style: 'destructive',
        onPress: () => {
          setWithdrawing(true);
          setActionError(null);
          setNotice(null);
          withdraw(active.id)
            .catch((err: unknown) => {
              setActionError(mapError(err));
              void refetch();
            })
            .finally(() => setWithdrawing(false));
        },
      },
    ]);
  };

  const cardClass = 'bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4';
  const titleClass = 'text-foreground dark:text-foreground-dark font-bold text-base mb-2';
  const mutedClass = 'text-muted-foreground dark:text-muted-foreground-dark text-sm';

  let body: React.ReactNode;
  if (!loaded && loading) {
    body = <ActivityIndicator color={themeColors.primary} />;
  } else if (!loaded && error) {
    body = (
      <View>
        <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
          {t('exit.load-error')}
        </Text>
        <TouchableOpacity
          onPress={() => void refetch()}
          className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (active) {
    body = (
      <View>
        <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm mb-1">
          {t(pending ? 'exit.pending.title' : 'exit.scheduled.title')}
        </Text>
        <Text className={`${mutedClass} mb-3`}>
          {pending
            ? pending.desiredEffectiveOn
              ? t('exit.pending.body-desired', { requested: formatDay(pending.requestedOn), desired: formatDay(pending.desiredEffectiveOn) })
              : t('exit.pending.body', { requested: formatDay(pending.requestedOn) })
            : t('exit.scheduled.body', { date: formatDay(active.effectiveOn) })}
        </Text>
        <TouchableOpacity
          className={`border border-border dark:border-border-dark rounded-xl items-center justify-center ${withdrawing ? 'opacity-50' : ''}`}
          style={{ minHeight: 48 }}
          onPress={confirmWithdraw}
          disabled={withdrawing}
          accessibilityRole="button"
          accessibilityLabel={t('exit.withdraw')}
          accessibilityState={{ disabled: withdrawing, busy: withdrawing }}
        >
          {withdrawing ? <ActivityIndicator color={themeColors.primary} /> : <Text className="text-destructive text-sm font-bold">{t('exit.withdraw')}</Text>}
        </TouchableOpacity>
      </View>
    );
  } else if (isOwner) {
    body = <Text className={mutedClass}>{t('exit.owner')}</Text>;
  } else {
    body = (
      <View>
        <Text className={`${mutedClass} mb-3`}>{noticeHint(preview, t)}</Text>
        {lastRejected ? (
          <Text className="text-destructive text-sm mb-3">{t('exit.rejected', { note: lastRejected.decisionNote ?? '—' })}</Text>
        ) : null}
        <TouchableOpacity
          className="border border-border dark:border-border-dark rounded-xl items-center justify-center"
          style={{ minHeight: 48 }}
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel={t('exit.start')}
        >
          <Text className="text-destructive text-sm font-bold">{t('exit.start')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className={cardClass}>
      <Text className={titleClass} accessibilityRole="header">
        {t('exit.title')}
      </Text>
      {body}
      {notice ? (
        <Text className="text-success dark:text-success-dark text-sm mt-3" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {actionError ? (
        <Text className="text-destructive text-sm mt-3" accessibilityRole="alert">
          {actionError}
        </Text>
      ) : null}

      <FormSheet
        visible={sheetOpen}
        title={t('exit.sheet.title')}
        onClose={() => setSheetOpen(false)}
        onSubmit={() => void handleSubmit()}
        submitLabel={t('exit.submit')}
        saving={saving}
        error={sheetError}
      >
        <Text className={`${mutedClass} mb-3`}>{t('exit.sheet.body')}</Text>
        {preview ? <Text className={`${mutedClass} mb-3`}>{noticeHint(preview, t)}</Text> : null}
        <Field label={t('exit.desired.label')}>
          <DateTimeField mode="date" value={desired} onChange={setDesired} clearable />
          {preview ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">
              {t('exit.desired.hint', { date: formatDay(preview.earliestEffectiveOn) })}
            </Text>
          ) : null}
        </Field>
        <Field label={t('exit.reason.label')}>
          <TextInput
            className={inputClassName}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
            multiline
            maxLength={2000}
            value={reason}
            onChangeText={setReason}
            placeholderTextColor={themeColors.mutedForeground}
            accessibilityLabel={t('exit.reason.label')}
          />
        </Field>
      </FormSheet>
    </View>
  );
}
