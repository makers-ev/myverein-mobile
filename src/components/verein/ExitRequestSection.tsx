import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import FormRenderer, { type FormRendererHandle } from '@/components/forms/FormRenderer';
import { useExitForm } from '@/hooks/useExitForm';
import { exitDialogTouched, exitFormFields, exitRequestBody, plainExitBody, repinExit } from '@/lib/exitForm';
import { type Answers, type FieldErrorCode, fieldErrorsFromError, formErrorKey, outdatedFrom, validateAnswers } from '@/lib/formSchema';
import { activeCancellation, exitErrorCode, formatDay, todayBerlin, useMyExitRequests, type ExitPreview } from '@/hooks/useExitRequests';
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
 * The sheet renders the club's published `austritt` form with the shared
 * FormRenderer (`GET /club-exit-requests/form`), validates it client-side and
 * sends the answers with the form version; a changed form (409
 * `FORM_VERSION_OUTDATED`) is re-rendered with the answers kept by key. The
 * answers are the record of the reason -- no separate reason is sent. Answers
 * live in component state only (never logged, cached or persisted).
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
  const [answers, setAnswers] = useState<Answers>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrorCode>>({});
  const [formNotice, setFormNotice] = useState<string | null>(null);
  // The form could not be loaded even after a retry: the person may cancel without it (date and plain reason only).
  const [withoutForm, setWithoutForm] = useState(false);
  const [reason, setReason] = useState('');
  const [formRetries, setFormRetries] = useState(0);
  const rendererRef = useRef<FormRendererHandle>(null);
  const exitForm = useExitForm(clubId, sheetOpen);

  // Answers do not outlive the sheet (they are personal data and only held in memory while it is open).
  useEffect(() => {
    if (!sheetOpen) {
      setAnswers({});
      setReason('');
    }
  }, [sheetOpen]);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const isOwner = ownerBlocked || (activeClub?.clubId === clubId && (activeClub.orgRole ?? '').split(',').map((r) => r.trim()).includes('owner'));
  const active = activeCancellation(requests, todayBerlin());
  const pending = active?.status === 'pending' ? active : null;
  const lastRejected = !active && requests[0]?.status === 'rejected' && requests[0].kind === 'cancellation' ? requests[0] : null;

  const mapError = (err: unknown): string => {
    const code = exitErrorCode(err);
    if (code === 'exit_request_pending') return t('exit.error.pending');
    if (code === 'exit_already_scheduled') return t('exit.error.scheduled');
    if (code === 'board_protected') return t('exit.error.board-protected');
    return apiErrorMessage(err, t);
  };

  const openSheet = () => {
    setDesired(null);
    setAnswers({});
    setReason('');
    setWithoutForm(false);
    setFormRetries(0);
    setFieldErrors({});
    setFormNotice(null);
    setSheetError(null);
    setNotice(null);
    setSheetOpen(true);
  };

  const desiredKey = desired ? toDateString(desired) : null;

  const closeSheet = () => {
    if (saving) return;
    if (!exitDialogTouched(desiredKey, answers) && reason.trim() === '') {
      setSheetOpen(false);
      return;
    }
    Alert.alert(t('forms.exit.discard.title'), t('forms.exit.discard.message'), [
      { text: t('forms.exit.discard.keep'), style: 'cancel' },
      { text: t('forms.exit.discard.confirm'), style: 'destructive', onPress: () => setSheetOpen(false) },
    ]);
  };

  const handleAnswer = (key: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setFieldErrors((e) => {
      if (!(key in e)) return e;
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
  };

  const handleSubmit = async () => {
    const definition = withoutForm ? null : exitForm.definition;
    if (saving || (!definition && !withoutForm)) return;
    // Upload fields are neither shown nor required here: the sheet has no upload and must never block a cancellation.
    const local = definition ? validateAnswers(exitFormFields(definition.fields), answers, { mode: 'submit' }) : {};
    const firstKey = Object.keys(local)[0];
    if (firstKey) {
      setFieldErrors(local);
      setSheetError(t('forms.err.fieldsInvalid'));
      rendererRef.current?.focusField(firstKey);
      return;
    }
    setSaving(true);
    setSheetError(null);
    setFieldErrors({});
    try {
      const created = await submit(definition ? exitRequestBody(desiredKey, definition, answers) : plainExitBody(desiredKey, reason));
      setSheetOpen(false);
      setNotice(
        created.adjustedToEarliest
          ? `${t('exit.submitted')} ${t('exit.adjusted', { date: formatDay(created.earliestEffectiveOn) })}`
          : t('exit.submitted'),
      );
    } catch (err) {
      const repin = definition ? repinExit(err, definition, answers) : null;
      if (definition && !repin && outdatedFrom(err)) {
        // The form changed and the club has no current one to show: reload instead of staying stuck on the old version.
        setFormNotice(t('forms.exit.outdated'));
        void exitForm.reload();
      } else if (repin) {
        // The club changed the form meanwhile: show the new one with the answers that still fit, nothing was filed.
        exitForm.replace(repin.definition);
        setAnswers(repin.answers);
        setFormNotice(repin.dropped.length > 0 ? t('forms.exit.outdated.lost', { fields: repin.dropped.join(', ') }) : t('forms.exit.outdated'));
      } else if (exitErrorCode(err) === 'owner_protected') {
        setOwnerBlocked(true);
        setSheetOpen(false);
      } else if (exitErrorCode(err)) {
        // State changed under us (open request / scheduled exit): show it on the card and resync.
        setSheetOpen(false);
        setActionError(mapError(err));
        void refetch();
      } else {
        const found = fieldErrorsFromError(err);
        if (found) setFieldErrors(found);
        setSheetError(t(formErrorKey(err)));
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

  // A failed refetch keeps the old data visible but must not look current.
  const staleBanner =
    loaded && error ? (
      <View className="mt-3">
        <Text className="text-destructive text-sm mb-1" accessibilityRole="alert">
          {t('exit.refresh-error')}
        </Text>
        <TouchableOpacity onPress={() => void refetch()} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
          <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.retry')}</Text>
        </TouchableOpacity>
      </View>
    ) : null;

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
      {staleBanner}
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
        onClose={closeSheet}
        onSubmit={() => void handleSubmit()}
        submitLabel={t('exit.submit')}
        submitDisabled={!exitForm.definition && !withoutForm}
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
        {formNotice ? (
          <View
            className="mb-3 rounded-lg border border-primary/40 dark:border-primary-dark/40 bg-primary/5 dark:bg-primary-dark/5 p-3"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text className="text-sm text-foreground dark:text-foreground-dark">{formNotice}</Text>
            <TouchableOpacity onPress={() => setFormNotice(null)} accessibilityRole="button" className="mt-1 self-start" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.updated.dismiss')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {withoutForm ? (
          <View>
            <Text className="text-sm text-foreground dark:text-foreground-dark mb-3" accessibilityRole="alert">
              {t('forms.exit.withoutForm')}
            </Text>
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
          </View>
        ) : exitForm.definition ? (
          <FormRenderer
            handleRef={rendererRef}
            fields={exitFormFields(exitForm.definition.fields)}
            privacyNotice={exitForm.definition.privacyNotice}
            answers={answers}
            onChange={handleAnswer}
            errors={fieldErrors}
            disabled={saving}
          />
        ) : exitForm.error ? (
          <View>
            <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
              {t('forms.exit.loadError')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setFormRetries((n) => n + 1);
                void exitForm.reload();
              }}
              className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
              style={{ minHeight: 44 }}
              accessibilityRole="button"
            >
              <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.retry')}</Text>
            </TouchableOpacity>
            {formRetries >= 1 ? (
              <TouchableOpacity
                onPress={() => setWithoutForm(true)}
                className="self-start mt-2 px-4 justify-center rounded-lg border border-border dark:border-border-dark"
                style={{ minHeight: 44 }}
                accessibilityRole="button"
              >
                <Text className="text-destructive text-sm font-bold">{t('forms.exit.skipForm')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ActivityIndicator color={themeColors.primary} accessibilityLabel={t('forms.exit.loading')} />
        )}
      </FormSheet>
    </View>
  );
}
