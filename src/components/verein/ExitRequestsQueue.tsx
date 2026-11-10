import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import {
  exitErrorCode,
  formatDay,
  useExitRequestQueue,
  type ExitRequest,
  type ExitRequestDetail,
} from '@/hooks/useExitRequests';
import AnswerList from '@/components/forms/AnswerList';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import Badge from '@/components/ui/Badge';
import Banner from '@/components/ui/Banner';
import DecisionCard from '@/components/ui/DecisionCard';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';

type Dialog = { kind: 'approve' | 'reject'; request: ExitRequest } | null;

/** Return checklist (open loans, keys) of the member concerned, loaded when the decision sheet opens. */
/** Answers of the exit form the member filled in (`Geschützt` marker for protected ones); nothing here influences the dates. */
function ExitAnswers({ detail }: { detail: ExitRequestDetail | null }) {
  const { t } = useLanguage();
  const submission = detail?.submission;
  if (!submission) return null;
  const muted = 'text-muted-foreground dark:text-muted-foreground-dark text-xs';
  return (
    <View className="mb-3">
      <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm mb-0.5" accessibilityRole="header">
        {t('forms.exit.answers.title')}
      </Text>
      <Text className={`${muted} mb-2`}>
        {t('forms.exit.answers.hint', { version: submission.version, date: submission.submittedAt ? formatDay(submission.submittedAt) : '—' })}
      </Text>
      {submission.answers.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('forms.review.answers.none')}</Text>
      ) : (
        <AnswerList answers={submission.answers} />
      )}
      {submission.answers.some((a) => a.redacted) ? <Text className={`${muted} mt-2`}>{t('forms.review.redacted.note')}</Text> : null}
    </View>
  );
}

function Checklist({ detail, loading, error }: { detail: ExitRequestDetail | null; loading: boolean; error: boolean }) {
  const { t } = useLanguage();
  const muted = 'text-muted-foreground dark:text-muted-foreground-dark text-xs';
  return (
    <View className="mb-3">
      <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm mb-1">{t('admin.exits.checklist.title')}</Text>
      {loading ? (
        <Text className={muted}>{t('admin.exits.checklist.loading')}</Text>
      ) : error || !detail ? (
        <Text className="text-destructive dark:text-destructive-dark text-xs">{t('admin.exits.checklist.error')}</Text>
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
 * Board queue of open exit requests (`members:write`) as decision cards (rule 2): facts first, then ONE primary that
 * names the outcome ("Zum 31.03.2027 genehmigen", opens the sheet with the date override / note) and a neutral
 * "Ablehnen" (note required). The own request shows a lock and an explanation instead of disabled buttons. The decision sheet
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
    return apiErrorMessage(err, t);
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
      if (err instanceof ApiError && err.status === 409 && !exitErrorCode(err)) {
        // An uncoded 409 is either "already decided" or "member already left / exit already effective":
        // re-read the request instead of guessing from the English backend text.
        void refetch();
        let stillPending = false;
        try {
          stillPending = (await loadDetail(request.id)).status === 'pending';
        } catch {
          // Could not tell: treat as decided elsewhere and let the refreshed list show the truth.
        }
        if (stillPending) {
          setDialogError(t('admin.exits.error.not-possible'));
        } else {
          setDialog(null);
          setListError(t('admin.exits.error.decided'));
        }
      } else {
        setDialogError(mapError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const muted = 'text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]';

  // A failed refetch keeps the old queue visible but must not look current.
  const staleBanner =
    loaded && error ? (
      <View className="mb-3">
        <Banner tone="warning" body={t('admin.exits.refresh-error')} action={{ label: t('verein.retry'), onPress: () => void refetch() }} alert />
      </View>
    ) : null;

  let body: React.ReactNode;
  if (!loaded && loading) {
    body = <Skeleton shape="rows" lines={2} />;
  } else if (!loaded && error) {
    body = <ErrorState fallbackKey="admin.exits.error" onRetry={() => void refetch()} />;
  } else if (requests.length === 0) {
    body = <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] px-1">{t('admin.exits.empty')}</Text>;
  } else {
    body = requests.map((r) => {
      const own = ownMemberId !== null && r.requestedBy === ownMemberId;
      const name = r.memberName ?? '—';
      const facts = [
        r.desiredEffectiveOn ? { label: t('admin.exits.fact.desired'), value: formatDay(r.desiredEffectiveOn) } : null,
        r.proposedEffectiveOn ? { label: t('admin.exits.fact.proposed'), value: formatDay(r.proposedEffectiveOn) } : null,
        r.reason ? { label: t('admin.exits.fact.reason'), value: r.reason } : null,
      ].filter((f): f is { label: string; value: string } => f !== null);
      return (
        <DecisionCard
          key={r.id}
          name={name}
          meta={t(r.kind === 'exclusion' ? 'admin.exits.meta.exclusion' : 'admin.exits.meta.cancellation', { date: formatDay(r.requestedOn) })}
          tags={
            r.kind === 'exclusion' || !r.hasAccount ? (
              <>
                {r.kind === 'exclusion' ? <Badge tone="danger">{t('admin.exits.kind.exclusion')}</Badge> : null}
                {!r.hasAccount ? <Badge>{t('admin.exits.no-account')}</Badge> : null}
              </>
            ) : undefined
          }
          facts={facts}
          blockedReason={own ? t('admin.exits.own-request') : null}
          primary={{
            label: r.proposedEffectiveOn ? t('admin.exits.approve.on', { date: formatDay(r.proposedEffectiveOn) }) : t('admin.exits.approve'),
            onPress: () => open('approve', r),
          }}
          secondary={{ label: t('admin.exits.reject'), onPress: () => open('reject', r) }}
        />
      );
    });
  }

  return (
    <View className="mb-6">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 px-1" accessibilityRole="header">
        {t('admin.exits.title')}
      </Text>
      {listError ? (
        <View className="mb-3">
          <Banner tone="info" body={listError} alert />
        </View>
      ) : null}
      {staleBanner}
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
            <ExitAnswers detail={detail} />
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
