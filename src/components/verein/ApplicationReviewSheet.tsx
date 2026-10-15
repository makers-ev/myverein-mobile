import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Baby, Check, FileText, Lock, ShieldCheck, X } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useApplicationReview, type ClubApplication } from '@/hooks/useClubApplications';
import { useMemberCategories } from '@/hooks/useClubMembers';
import {
  answerText,
  type ApproveResult,
  duplicateKindKey,
  isStaleDecision,
  canDecide,
  mappingReasonKey,
  mappingTargetText,
  NOTE_MAX_LENGTH,
  type ReviewFile,
  reviewErrorKey,
  reviewFileView,
  reviewWarningKey,
  shortHash,
} from '@/lib/applicationReview';
import { formatBytes } from '@/lib/formSchema';
import { clearReviewFileCache, downloadReviewImage } from '@/lib/media';
import { useThemeColors } from '@/theme/colors';

export interface DecisionOutcome {
  action: 'approved' | 'rejected';
  name: string;
  child: boolean;
  /** Answers that could not be taken over into the member record (only on approval). */
  skipped: number;
}

interface Props {
  clubId: string;
  application: ClubApplication;
  onClose: () => void;
  /** A decision went through (or turned out to be stale); the parent reloads its list. */
  onDecided: (outcome: DecisionOutcome | null) => void;
  approve: (id: string, categoryId: string) => Promise<ApproveResult | undefined>;
  reject: (id: string, note: string, applicantMessage: string) => Promise<void>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-5">
      <Text className="text-sm font-bold text-foreground dark:text-foreground-dark" accessibilityRole="header">
        {title}
      </Text>
      <View className="mt-2">{children}</View>
    </View>
  );
}

function Hint({ text, tone }: { text: string; tone: 'warning' | 'info' }) {
  const themeColors = useThemeColors();
  return (
    <View
      className={`flex-row rounded-lg border p-3 ${
        tone === 'warning'
          ? 'border-warning/40 dark:border-warning-dark/40 bg-warning/10 dark:bg-warning-dark/10'
          : 'border-border dark:border-border-dark bg-muted/40 dark:bg-muted-dark/40'
      }`}
      style={{ gap: 8 }}
    >
      {tone === 'warning' ? <AlertTriangle size={16} color={themeColors.warning} style={{ marginTop: 2 }} /> : null}
      <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">{text}</Text>
    </View>
  );
}

const formatDateTime = (iso: string, language: string) =>
  new Date(iso).toLocaleString(language, { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatDay = (value: string, language: string) => new Date(`${value.slice(0, 10)}T00:00`).toLocaleDateString(language);

/**
 * Review of one application (Wave 8 M3, "Vorstand light"): answers rendered against the form version the person filled in,
 * images (downloaded with the session into a private cache file, hidden/deleted as soon as they are closed -- never a raw
 * URL), consent evidence, mapping preview, duplicate hint and warnings; the board accepts (optionally overriding the
 * category) or rejects (internal note + a message to the applicant, kept apart). Protected answers the caller may not read
 * arrive redacted and are shown as such. PDF documents are listed but only openable on the website.
 */
export default function ApplicationReviewSheet({ clubId, application, onClose, onDecided, approve, reject }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { review, loading, error, refetch } = useApplicationReview(clubId, application.id);
  const { categories } = useMemberCategories(clubId);
  const [categoryId, setCategoryId] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // Another board member decided (or the applicant withdrew) meanwhile: only closing makes sense.
  const [stale, setStale] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ id: string; uri: string } | null>(null);
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const removePreview = useRef<(() => void) | null>(null);

  const dropPreview = useCallback(() => {
    removePreview.current?.();
    removePreview.current = null;
    setPreview(null);
  }, []);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    abort.current = controller;
    // A crashed or killed earlier session may have left photos in the cache: sweep them before anything is shown.
    clearReviewFileCache();
    return () => {
      alive.current = false;
      controller.abort();
      removePreview.current?.();
      removePreview.current = null;
      clearReviewFileCache();
    };
  }, []);

  // Leaving the app (app switcher snapshot, another app in front) removes the applicant's photo from the cache and the screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        dropPreview();
        clearReviewFileCache();
      }
    });
    return () => sub.remove();
  }, [dropPreview]);

  const pending = canDecide(review?.application.status, stale);
  const child = (review?.application.onBehalfOf ?? application.onBehalfOf) === 'guardian';
  const subjectName = review?.subject.displayName ?? application.subjectName ?? application.name ?? '—';

  const wishedCategory = (() => {
    const key = review?.application.category ?? application.category;
    if (!key) return null;
    const found = categories.find((c) => c.key === key);
    if (found) return found.name;
    const text = t(`verein.category.${key}`);
    return text === `verein.category.${key}` ? key : text;
  })();

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true);
    setErrorKey(null);
    try {
      if (action === 'approve') {
        const res = await approve(application.id, categoryId);
        if (!alive.current) return;
        onDecided({ action: 'approved', name: subjectName, child, skipped: res?.mapping?.skipped?.length ?? 0 });
      } else {
        await reject(application.id, note, message);
        if (!alive.current) return;
        onDecided({ action: 'rejected', name: subjectName, child, skipped: 0 });
      }
    } catch (err) {
      if (!alive.current) return;
      setErrorKey(reviewErrorKey(err));
      setBusy(false);
      // Someone else decided (or the applicant withdrew): the list behind this sheet is stale.
      if (isStaleDecision(err)) {
        setStale(true);
        onDecided(null);
      }
    }
  };

  const showImage = async (file: ReviewFile) => {
    if (!file.path || !abort.current) return;
    setFileBusy(file.id);
    setFileErrors((e) => {
      const copy = { ...e };
      delete copy[file.id];
      return copy;
    });
    try {
      const res = await downloadReviewImage(file.path, abort.current.signal);
      if (!alive.current) {
        if ('remove' in res) res.remove();
        return;
      }
      if ('error' in res) {
        if (abort.current.signal.aborted) return;
        setFileErrors((e) => ({ ...e, [file.id]: t(reviewErrorKey(res.error)) }));
        return;
      }
      // One image at a time: the previous cache file goes away when another one is shown.
      removePreview.current?.();
      removePreview.current = res.remove;
      setPreview({ id: file.id, uri: res.uri });
    } finally {
      if (alive.current) setFileBusy(null);
    }
  };

  const redactedAny = review?.answers.some((a) => a.redacted) || review?.files.some((f) => f.redacted);
  const inputClass =
    'bg-muted dark:bg-muted-dark rounded-lg px-3 py-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark';

  const footer =
    review && pending ? (
      rejecting ? (
        <View className="flex-row" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => setRejecting(false)}
            disabled={busy}
            accessibilityRole="button"
            className={`flex-1 border border-border dark:border-border-dark rounded-xl items-center justify-center ${busy ? 'opacity-60' : ''}`}
            style={{ minHeight: 48 }}
          >
            <Text className="text-foreground dark:text-foreground-dark font-semibold">{t('forms.review.reject.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void decide('reject')}
            disabled={busy}
            accessibilityRole="button"
            className={`flex-1 bg-destructive rounded-xl items-center justify-center ${busy ? 'opacity-60' : ''}`}
            style={{ minHeight: 48 }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">{t('forms.review.reject.confirm')}</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => setRejecting(true)}
            disabled={busy}
            accessibilityRole="button"
            className={`flex-1 border border-border dark:border-border-dark rounded-xl items-center justify-center ${busy ? 'opacity-60' : ''}`}
            style={{ minHeight: 48 }}
          >
            <Text className="text-destructive font-bold">{t('verein.applications.reject')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void decide('approve')}
            disabled={busy}
            accessibilityRole="button"
            className={`flex-1 bg-primary dark:bg-primary-dark rounded-xl items-center justify-center ${busy ? 'opacity-60' : ''}`}
            style={{ minHeight: 48 }}
          >
            {busy ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('verein.applications.approve')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )
    ) : (
      <TouchableOpacity
        onPress={onClose}
        accessibilityRole="button"
        className="border border-border dark:border-border-dark rounded-xl items-center justify-center"
        style={{ minHeight: 48 }}
      >
        <Text className="text-foreground dark:text-foreground-dark font-semibold">{t('forms.review.close')}</Text>
      </TouchableOpacity>
    );

  return (
    <Modal visible animationType="slide" onRequestClose={busy ? () => undefined : onClose}>
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center px-5 pt-3 pb-2" style={{ gap: 8 }}>
          <Text className="flex-1 text-lg font-bold text-foreground dark:text-foreground-dark" numberOfLines={2} accessibilityRole="header">
            {t('forms.review.title', { name: subjectName })}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('forms.review.closeA11y')}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={22} color={themeColors.foreground} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View className="mt-4" accessibilityRole="alert">
              <Text className="text-destructive text-sm mb-3">{t(reviewErrorKey(error))}</Text>
              <TouchableOpacity
                onPress={() => void refetch()}
                accessibilityRole="button"
                className="bg-primary dark:bg-primary-dark rounded-lg px-5 self-start items-center justify-center"
                style={{ minHeight: 44 }}
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('forms.review.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : !review || loading ? (
            <View className="mt-10 items-center" accessibilityLiveRegion="polite">
              <ActivityIndicator size="large" color={themeColors.primary} />
              <Text className="text-sm mt-3 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.loading')}</Text>
            </View>
          ) : (
            <View>
              <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
                {child ? (
                  <View className="flex-row items-center rounded-full bg-primary/10 dark:bg-primary-dark/10 px-2.5 py-0.5" style={{ gap: 4 }}>
                    <Baby size={14} color={themeColors.primary} />
                    <Text className="text-xs font-semibold text-primary dark:text-primary-dark">{t('forms.review.badge.child')}</Text>
                  </View>
                ) : null}
                {review.application.legacy ? (
                  <View className="rounded-full bg-muted dark:bg-muted-dark px-2.5 py-0.5">
                    <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.badge.legacy')}</Text>
                  </View>
                ) : null}
                {review.application.status !== 'pending' ? (
                  <View className="rounded-full bg-muted dark:bg-muted-dark px-2.5 py-0.5">
                    <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">
                      {t(`forms.review.status.${review.application.status}`)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-3" style={{ gap: 8 }}>
                <View>
                  <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">
                    {child ? t('forms.review.applicant.guardian') : t('forms.review.applicant')}
                  </Text>
                  <Text className="text-sm text-foreground dark:text-foreground-dark">{review.applicant.name || '—'}</Text>
                  <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{review.applicant.email}</Text>
                </View>
                {child ? (
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.subject.child')}</Text>
                    <Text className="text-sm text-foreground dark:text-foreground-dark">{review.subject.displayName ?? '—'}</Text>
                  </View>
                ) : null}
                <View>
                  <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.subject.age')}</Text>
                  <Text className="text-sm text-foreground dark:text-foreground-dark">
                    {review.subject.birthDate
                      ? `${formatDay(review.subject.birthDate, language)}${
                          review.subject.ageYears !== null ? ` (${t('forms.review.subject.years', { n: review.subject.ageYears })})` : ''
                        }`
                      : review.subject.ageBand
                        ? t(review.subject.ageBand === '<18' ? 'forms.review.subject.under18' : 'forms.review.subject.over18')
                        : '—'}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.submittedAt')}</Text>
                  <Text className="text-sm text-foreground dark:text-foreground-dark">{formatDateTime(review.application.createdAt, language)}</Text>
                </View>
              </View>

              {child ? (
                <View className="mt-3">
                  <Hint tone="info" text={t('forms.review.child.note', { guardian: review.applicant.name || review.applicant.email })} />
                </View>
              ) : null}
              {review.application.legacy ? (
                <View className="mt-3">
                  <Hint tone="info" text={t('forms.review.legacy.note')} />
                </View>
              ) : null}

              {review.warnings.length > 0 || review.duplicates.length > 0 ? (
                <View className="mt-4" style={{ gap: 8 }} accessibilityLabel={t('forms.review.hints')}>
                  {review.warnings.map((w) => {
                    const key = reviewWarningKey(w);
                    return key ? <Hint key={w} tone="warning" text={t(key)} /> : null;
                  })}
                  {review.duplicates.map((d) => (
                    <Hint
                      key={d.clubMemberId}
                      tone="warning"
                      text={t('forms.review.duplicate', { name: d.displayName, reason: t(duplicateKindKey(d.matches)) })}
                    />
                  ))}
                </View>
              ) : null}

              {redactedAny ? (
                <View className="flex-row mt-4" style={{ gap: 8 }}>
                  <Lock size={14} color={themeColors.mutedForeground} style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.redacted.note')}</Text>
                </View>
              ) : null}

              {!review.application.legacy ? (
                <Section title={t('forms.review.answers')}>
                  {!review.answersRetained ? (
                    <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.answers.erased')}</Text>
                  ) : review.answers.length === 0 ? (
                    <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.answers.none')}</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {review.answers.map((a) => (
                        <View key={a.key} className="rounded-lg border border-border dark:border-border-dark px-3 py-2">
                          <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{a.label}</Text>
                          {/* Plain text: answers are applicant input and are never interpreted as markup. */}
                          {a.redacted ? (
                            <View className="flex-row items-center mt-0.5" style={{ gap: 6 }}>
                              <Lock size={14} color={themeColors.mutedForeground} />
                              <Text className="text-sm italic text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.redacted')}</Text>
                            </View>
                          ) : (
                            <Text
                              className={`text-sm mt-0.5 ${a.answered ? 'text-foreground dark:text-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
                              selectable
                            >
                              {answerText(a, t)}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </Section>
              ) : null}

              {!review.application.legacy ? (
                <Section title={t('forms.review.files')}>
                  {review.files.length === 0 ? (
                    <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.files.none')}</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {review.files.map((f) => {
                        const view = reviewFileView(f);
                        const shown = preview?.id === f.id;
                        return (
                          <View key={f.id} className="rounded-lg border border-border dark:border-border-dark px-3 py-2">
                            <View className="flex-row items-center" style={{ gap: 8 }}>
                              <FileText size={16} color={themeColors.mutedForeground} />
                              <View className="flex-1">
                                <Text className="text-sm font-medium text-foreground dark:text-foreground-dark" numberOfLines={1}>
                                  {f.redacted ? t('forms.review.redacted') : (f.filename ?? '—')}
                                </Text>
                                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={1}>
                                  {f.fieldLabel ?? '—'}
                                  {f.sizeBytes !== null ? ` · ${formatBytes(f.sizeBytes, language)}` : ''}
                                </Text>
                              </View>
                              {view === 'image' ? (
                                <TouchableOpacity
                                  onPress={() => (shown ? dropPreview() : void showImage(f))}
                                  disabled={fileBusy === f.id}
                                  accessibilityRole="button"
                                  className="rounded-lg border border-border dark:border-border-dark px-3 items-center justify-center"
                                  style={{ minHeight: 44 }}
                                >
                                  {fileBusy === f.id ? (
                                    <ActivityIndicator size="small" color={themeColors.primary} />
                                  ) : (
                                    <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                                      {shown ? t('forms.review.file.hide') : t('forms.review.file.show')}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              ) : view === 'protected' ? (
                                <View className="flex-row items-center" style={{ gap: 4 }}>
                                  <Lock size={14} color={themeColors.mutedForeground} />
                                  <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.file.protected')}</Text>
                                </View>
                              ) : null}
                            </View>
                            {view === 'document' ? (
                              <Text className="text-xs mt-1 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.file.pdfOnWebsite')}</Text>
                            ) : null}
                            {shown && preview ? (
                              <Image
                                source={{ uri: preview.uri }}
                                resizeMode="contain"
                                accessibilityLabel={t('forms.review.file.imageAlt', { name: f.fieldLabel ?? f.filename ?? '' })}
                                style={{ width: '100%', height: 280, marginTop: 8, borderRadius: 8 }}
                                onError={() => {
                                  dropPreview();
                                  setFileErrors((e) => ({ ...e, [f.id]: t('forms.review.file.loadFailed') }));
                                }}
                              />
                            ) : null}
                            {fileErrors[f.id] ? (
                              <Text className="text-destructive text-xs mt-1" accessibilityRole="alert" accessibilityLiveRegion="polite">
                                {fileErrors[f.id]}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Section>
              ) : null}

              <Section title={t('forms.review.consent')}>
                {review.consent ? (
                  <View className="rounded-lg border border-border dark:border-border-dark p-3">
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <ShieldCheck size={16} color={themeColors.primary} />
                      <Text className="flex-1 text-sm font-medium text-foreground dark:text-foreground-dark">
                        {review.consent.consentFieldKeys.length > 0 ? t('forms.review.consent.given') : t('forms.review.consent.notGiven')}
                      </Text>
                    </View>
                    <View className="mt-2" style={{ gap: 4 }}>
                      {review.consent.fields.map((f) => (
                        <View key={f.key} className="flex-row" style={{ gap: 8 }} accessibilityLabel={`${f.label}: ${t(f.given ? 'forms.review.yes' : 'forms.review.no')}`}>
                          {f.given ? <Check size={16} color={themeColors.success} /> : <X size={16} color={themeColors.destructive} />}
                          <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">{f.label}</Text>
                        </View>
                      ))}
                    </View>
                    <View className="mt-3" style={{ gap: 2 }}>
                      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                        {t('forms.review.consent.by')}: {review.consent.givenBy.name || '—'} (
                        {t(review.consent.role === 'guardian' ? 'forms.review.consent.role.guardian' : 'forms.review.consent.role.self')})
                      </Text>
                      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                        {t('forms.review.consent.at')}: {review.consent.consentedAt ? formatDateTime(review.consent.consentedAt, language) : '—'}
                      </Text>
                      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                        {t('forms.review.consent.notice')}: {t(review.consent.privacyNoticeShown ? 'forms.review.yes' : 'forms.review.no')}
                      </Text>
                      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                        {t('forms.review.consent.version')}: {review.form ? `${review.form.version} · ` : ''}
                        {shortHash(review.consent.textSha256)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.consent.none')}</Text>
                )}
              </Section>

              {pending && review.mapping.preview && review.mapping.entries.length > 0 ? (
                <Section title={t('forms.review.mapping')}>
                  <Text className="text-xs mb-2 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.mapping.hint')}</Text>
                  <View style={{ gap: 6 }}>
                    {review.mapping.entries.map((e) => {
                      const target = mappingTargetText(e, t);
                      return (
                        <View key={e.fieldKey} className="flex-row" style={{ gap: 8 }}>
                          {e.willApply ? <Check size={16} color={themeColors.success} /> : <X size={16} color={themeColors.mutedForeground} />}
                          <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">
                            {e.fieldLabel} →{' '}
                            {target
                              ? e.willApply
                                ? t('forms.review.mapping.as', { target })
                                : t('forms.review.mapping.not', { target, reason: t(mappingReasonKey(e.reason)) })
                              : t('forms.review.mapping.reason.unknown_target')}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Section>
              ) : null}

              {review.decision && !pending ? (
                <Section title={t('forms.review.decision')}>
                  <View style={{ gap: 6 }}>
                    {review.decision.decidedAt ? (
                      <Text className="text-sm text-foreground dark:text-foreground-dark">
                        {t('forms.review.decision.at')}: {formatDateTime(review.decision.decidedAt, language)}
                      </Text>
                    ) : null}
                    {review.decision.internalNote ? (
                      <View>
                        <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{t('forms.review.note.label')}</Text>
                        <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{review.decision.internalNote}</Text>
                      </View>
                    ) : null}
                    {review.decision.decisionNote ? (
                      <View>
                        <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{t('forms.review.message.label')}</Text>
                        <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{review.decision.decisionNote}</Text>
                      </View>
                    ) : null}
                  </View>
                </Section>
              ) : null}

              {pending && !rejecting ? (
                <Section title={t('forms.review.category')}>
                  <Text className="text-xs font-semibold mb-1 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.category.label')}</Text>
                  <View accessibilityRole="radiogroup" style={{ gap: 4 }}>
                    {[{ id: '', name: wishedCategory ? t('forms.review.category.keep', { name: wishedCategory }) : t('forms.review.category.keepNone') }, ...categories].map((c) => {
                      const selected = categoryId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id || 'keep'}
                          onPress={() => setCategoryId(c.id)}
                          disabled={busy}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected, disabled: busy }}
                          accessibilityLabel={c.name}
                          className="flex-row items-center"
                          style={{ minHeight: 44, gap: 10 }}
                        >
                          <View
                            className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                              selected ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
                            }`}
                          >
                            {selected ? <View className="w-3 h-3 rounded-full bg-primary dark:bg-primary-dark" /> : null}
                          </View>
                          <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">{c.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Section>
              ) : null}

              {pending && rejecting ? (
                <Section title={t('forms.review.reject.title')}>
                  <View style={{ gap: 16 }}>
                    <View>
                      <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{t('forms.review.message.label')}</Text>
                      <Text className="text-xs mt-0.5 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.message.hint')}</Text>
                      <TextInput
                        className={`${inputClass} mt-1`}
                        accessibilityLabel={t('forms.review.message.label')}
                        accessibilityHint={t('forms.review.message.hint')}
                        multiline
                        maxLength={NOTE_MAX_LENGTH}
                        style={{ minHeight: 84, textAlignVertical: 'top' }}
                        placeholderTextColor={themeColors.mutedForeground}
                        value={message}
                        editable={!busy}
                        onChangeText={setMessage}
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{t('forms.review.note.label')}</Text>
                      <Text className="text-xs mt-0.5 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.note.hint')}</Text>
                      <TextInput
                        className={`${inputClass} mt-1`}
                        accessibilityLabel={t('forms.review.note.label')}
                        accessibilityHint={t('forms.review.note.hint')}
                        multiline
                        maxLength={NOTE_MAX_LENGTH}
                        style={{ minHeight: 64, textAlignVertical: 'top' }}
                        placeholderTextColor={themeColors.mutedForeground}
                        value={note}
                        editable={!busy}
                        onChangeText={setNote}
                      />
                    </View>
                  </View>
                </Section>
              ) : null}

              {errorKey ? (
                <Text className="text-destructive text-sm mt-4" accessibilityRole="alert" accessibilityLiveRegion="polite">
                  {t(errorKey)}
                </Text>
              ) : null}
            </View>
          )}
        </KeyboardAwareScrollView>

        {review || error ? (
          <View className="px-5 pt-3 pb-3 border-t border-border dark:border-border-dark bg-background dark:bg-background-dark">{footer}</View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
