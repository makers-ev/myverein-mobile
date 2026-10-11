import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import {
  exitErrorCode,
  formatDay,
  useExitRequestQueue,
  type ExitRequest,
  type ExitRequestDetail,
} from '@/hooks/useExitRequests';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';

type Dialog = { kind: 'approve' | 'reject'; request: ExitRequest } | null;

/** Return checklist (open loans, keys) of the member concerned, loaded when the decision sheet opens. */
function Checklist({ detail, loading, error }: { detail: ExitRequestDetail | null; loading: boolean; error: boolean }) {
  const { t } = useLanguage();
  const muted = 'text-muted-foreground dark:text-muted-foreground-dark text-xs';
  return (
    <View className="mb-3">
      <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm mb-1">{t('admin.exits.checklist.title')}</Text>
      {loading ? (
        <Text className={muted}>{t('admin.exits.checklist.loading')}</Text>
      ) : error || !detail ? (
        <Text className="text-destructive text-xs">{t('admin.exits.checklist.error')}</Text>
      ) : detail.checklist.isEmpty ? (
        <Text className={muted}>{t('admin.exits.checklist.empty')}</Text>
      ) : (
        <>
          {detail.checklist.openLoans.length > 0 ? (
            <Text className={`${muted} mb-0.5`}>
              {t('admin.exits.checklist.loans')}:{' '}
              {detail.checklist.openLoans.map((l) => (l.overdue ? `${l.itemName} (${t('admin.exits.checklist.overdue')})` : l.itemName)).join(', ')}
            </Text>
          ) : null}
          {detail.checklist.keys.length > 0 ? (
            <Text className={muted}>
              {t('admin.exits.checklist.keys')}: {detail.checklist.keys.map((k) => k.locationName).join(', ')}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * Compact board queue of open exit requests (`members:write`): approve (with
 * optional date override / note) or reject (note required). The decision sheet
 * shows the member's return checklist. The caller renders it only with the
 * permission; the backend enforces it again.
 */
export default function ExitRequestsQueue({ clubId, ownMemberId }: { clubId: string; ownMemberId: string | null }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { requests, loaded, loading, error, refetch, loadDetail, approve, reject } = useExitRequestQueue(clubId, true);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [detail, setDetail] = useState<ExitRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [effective, setEffective] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const requestId = dialog?.request.id ?? null;
  // Load the checklist for the open decision (cancelled if another one opens meanwhile).
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    setDetail(null);
    setDetailError(false);
    setDetailLoading(true);
    loadDetail(requestId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetailError(true);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, loadDetail]);

  const open = (kind: 'approve' | 'reject', request: ExitRequest) => {
    setNote('');
    setDialogError(null);
    setListError(null);
    setEffective(fromDateString(request.proposedEffectiveOn));
    setDialog({ kind, request });
  };
  const close = () => setDialog(null);

  const mapError = (err: unknown): string => {
    const code = exitErrorCode(err);
    if (code === 'self_approval') return t('admin.exits.error.self');
    if (code === 'owner_protected') return t('admin.exits.error.owner');
    if (code === 'exit_already_scheduled') return t('admin.exits.error.scheduled');
    return err instanceof ApiError ? err.message : t('alert.general-error-description');
  };

  const handleDecision = async () => {
    if (!dialog || saving) return;
    const { request } = dialog;
    if (dialog.kind === 'reject' && !note.trim()) {
      setDialogError(t('admin.exits.reject.note.required'));
      return;
    }
    const effectiveKey = effective ? toDateString(effective) : null;
    if (dialog.kind === 'approve' && effectiveKey && request.earliestEffectiveOn && effectiveKey < request.earliestEffectiveOn) {
      setDialogError(t('admin.exits.effective.too-early', { date: formatDay(request.earliestEffectiveOn) }));
      return;
    }
    setSaving(true);
    setDialogError(null);
    try {
      if (dialog.kind === 'approve') {
        // Only send a date when the board changed the proposal.
        const override = effectiveKey && effectiveKey !== request.proposedEffectiveOn ? effectiveKey : undefined;
        await approve(request.id, { effectiveOn: override, note });
      } else {
        await reject(request.id, note);
      }
      setDialog(null);
    } catch (err) {
      const message = mapError(err);
      if (err instanceof ApiError && err.status === 409 && !exitErrorCode(err)) {
        // Decided elsewhere meanwhile: close and resync the queue.
        setDialog(null);
        setListError(t('admin.exits.error.decided'));
        void refetch();
      } else {
        setDialogError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const muted = 'text-muted-foreground dark:text-muted-foreground-dark text-xs';

  let body: React.ReactNode;
  if (!loaded && loading) {
    body = <ActivityIndicator color={themeColors.primary} />;
  } else if (!loaded && error) {
    body = (
      <View>
        <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
          {t('admin.exits.error')}
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
  } else if (requests.length === 0) {
    body = <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('admin.exits.empty')}</Text>;
  } else {
    body = requests.map((r, i) => {
      const own = ownMemberId !== null && r.requestedBy === ownMemberId;
      return (
        <View key={r.id} className={`py-3 ${i === requests.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}>
          <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
            <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm flex-1">{r.memberName ?? '—'}</Text>
            {r.kind === 'exclusion' ? <Text className="text-destructive text-xs font-semibold">{t('admin.exits.kind.exclusion')}</Text> : null}
            {!r.hasAccount ? <Text className={muted}>{t('admin.exits.no-account')}</Text> : null}
          </View>
          <Text className={`${muted} mt-0.5`}>{t('admin.exits.requested', { date: formatDay(r.requestedOn) })}</Text>
          {r.desiredEffectiveOn ? <Text className={muted}>{t('admin.exits.desired', { date: formatDay(r.desiredEffectiveOn) })}</Text> : null}
          {r.proposedEffectiveOn ? <Text className={muted}>{t('admin.exits.proposed', { date: formatDay(r.proposedEffectiveOn) })}</Text> : null}
          {r.reason ? <Text className={muted}>{t('admin.exits.reason', { reason: r.reason })}</Text> : null}
          {own ? <Text className={`${muted} mt-1`}>{t('admin.exits.own-request')}</Text> : null}
          <View className="flex-row mt-2" style={{ gap: 8 }}>
            <TouchableOpacity
              className={`flex-1 bg-primary dark:bg-primary-dark rounded-lg items-center justify-center ${own ? 'opacity-50' : ''}`}
              style={{ minHeight: 44 }}
              onPress={() => open('approve', r)}
              disabled={own}
              accessibilityRole="button"
              accessibilityLabel={`${t('admin.exits.approve')}: ${r.memberName ?? ''}`}
              accessibilityState={{ disabled: own }}
            >
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('admin.exits.approve')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 rounded-lg items-center justify-center border border-border dark:border-border-dark"
              style={{ minHeight: 44 }}
              onPress={() => open('reject', r)}
              accessibilityRole="button"
              accessibilityLabel={`${t('admin.exits.reject')}: ${r.memberName ?? ''}`}
            >
              <Text className="text-destructive text-sm font-bold">{t('admin.exits.reject')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  }

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-2" accessibilityRole="header">
        {t('admin.exits.title')}
      </Text>
      {listError ? (
        <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
          {listError}
        </Text>
      ) : null}
      {body}

      <FormSheet
        visible={dialog !== null}
        title={dialog?.kind === 'reject' ? t('admin.exits.reject.title') : t('admin.exits.approve.title')}
        onClose={close}
        onSubmit={() => void handleDecision()}
        submitLabel={dialog?.kind === 'reject' ? t('admin.exits.reject.submit') : t('admin.exits.approve.submit')}
        saving={saving}
        error={dialogError}
      >
        {dialog ? (
          <>
            <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm mb-3">{dialog.request.memberName ?? '—'}</Text>
            <Checklist detail={detail} loading={detailLoading} error={detailError} />
            {dialog.kind === 'approve' ? (
              <Field label={t('admin.exits.effective.label')}>
                <DateTimeField mode="date" value={effective} onChange={setEffective} />
                {dialog.request.earliestEffectiveOn ? (
                  <Text className={`${muted} mt-1`}>{t('admin.exits.effective.hint', { date: formatDay(dialog.request.earliestEffectiveOn) })}</Text>
                ) : null}
              </Field>
            ) : null}
            <Field label={dialog.kind === 'reject' ? t('admin.exits.reject.note.label') : t('admin.exits.note.label')}>
              <TextInput
                className={inputClassName}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                multiline
                maxLength={1000}
                value={note}
                onChangeText={setNote}
                placeholderTextColor={themeColors.mutedForeground}
                accessibilityLabel={dialog.kind === 'reject' ? t('admin.exits.reject.note.label') : t('admin.exits.note.label')}
              />
            </Field>
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}
