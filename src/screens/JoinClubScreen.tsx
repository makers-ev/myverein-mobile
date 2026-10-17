import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Clock } from 'lucide-react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import ApplicationForm from '@/components/verein/ApplicationForm';
import MyApplicationsStatus from '@/components/verein/MyApplicationsStatus';
import { getStoredApplyClubSlug, setStoredApplyClubSlug } from '@/clubs/lastApplyClubStorage';
import { useClubForm } from '@/hooks/useClubForm';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useMyApplications } from '@/hooks/useMyApplications';
import { normalizeClubSlug } from '@/lib/applicationStatus';
import type { SubmittedResult } from '@/hooks/useFormSubmission';
import { ApiError } from '@/lib/api';
import { type ApplyConflict, childWarningKey, formErrorKey, type OnBehalfOf } from '@/lib/formSchema';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinClub'>;

type Conflict = Exclude<ApplyConflict, 'other'>;
const CONFLICT_KEY: Record<Conflict, 'already-member' | 'application-pending'> = {
  already_member: 'already-member',
  application_pending: 'application-pending',
};

/**
 * Digital membership application (Wave 8 M2). A club shares its code out-of-band (website, flyer, word of mouth) --
 * there is no public "browse clubs" directory. The screen loads that club's own application form
 * (`GET /club-forms/:slug/aufnahme`), renders it with the shared `FormRenderer` (via `ApplicationForm`), keeps a draft
 * **on the server** while the person types (debounced autosave through a serial queue) and files it
 * (`POST /form-submissions/:id/submit`). The applicant is NOT a member afterwards -- the board has to approve first, so
 * open applications are listed as "wartet auf Entscheidung" and can be withdrawn. If the club's form supports it, a
 * parent can apply for a child (separate draft and application). A changed form version (`FORM_VERSION_OUTDATED`)
 * re-pins the draft, keeps the answers and shows what was dropped. Answers are never logged, cached or put into
 * AsyncStorage. The legacy apply (category/birth date only) is gone: the backend answers it with `409 form_required`.
 */
export default function JoinClubScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { club, phase, loadErrorKey, refreshing, refreshFailed, load, reset, markSubmitted, withdraw } = useClubForm();
  const [slug, setSlug] = useState('');
  const { user, resendVerificationEmail, refetchSession, isAuthenticated } = useAuth();
  const applications = useMyApplications(isAuthenticated);
  const reloadApplications = applications.reload;
  const slugTouched = useRef(false);
  const { refetch: refetchClubs } = useMyClubs();
  // An accepted application means the membership exists now: refresh the shared club list so the Verein tab shows it.
  const hasAccepted = applications.decided.some((d) => d.status === 'accepted');
  useEffect(() => {
    if (hasAccepted) void refetchClubs();
  }, [hasAccepted, refetchClubs]);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  // A child application needs a verified e-mail address: known from the session, or reported by the server (403).
  const [serverBlocked, setServerBlocked] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [checking, setChecking] = useState(false);
  const [banner, setBanner] = useState<{ warnings: string[] } | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const registerFlush = useCallback((flush: (() => Promise<void>) | null) => {
    flushRef.current = flush;
  }, []);

  // The club code last applied to is offered again (a public code, not a secret); typing before it arrives wins.
  useEffect(() => {
    let cancelled = false;
    void getStoredApplyClubSlug().then((stored) => {
      if (!cancelled && stored && !slugTouched.current) setSlug(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Back on the code entry (also after `reset`): the list of own applications may have changed meanwhile.
  useEffect(() => {
    if (phase === 'slug' && isAuthenticated) void reloadApplications();
  }, [phase, isAuthenticated, reloadApplications]);

  const openClub = async (value: string, mode?: OnBehalfOf) => {
    setBanner(null);
    setActionErrorKey(null);
    setSlug(value);
    // Loading the club resumes the newest open draft of that club and mode, so no second draft is started next to it.
    const ok = await load(value, mode);
    if (ok) void setStoredApplyClubSlug(value);
  };

  const handleLoad = () => {
    const value = normalizeClubSlug(slug) ?? slug.trim().toLowerCase();
    if (!value) return;
    void openClub(value);
  };

  const changeMode = async (next: OnBehalfOf) => {
    if (!club || next === club.mode) return;
    // A pending autosave of the form that goes away is finished first, so its draft shows up when the other mode loads.
    await flushRef.current?.().catch(() => undefined);
    setBanner(null);
    await load(club.slug, next);
  };

  const backToSlug = async () => {
    await flushRef.current?.().catch(() => undefined);
    reset();
    setBanner(null);
    setActionErrorKey(null);
  };

  const doWithdraw = async (id: string) => {
    if (!club) return;
    setWithdrawBusy(true);
    setActionErrorKey(null);
    try {
      // Typing that is still waiting for its autosave must not be lost by the reload that follows.
      await flushRef.current?.().catch(() => undefined);
      await withdraw(id);
      setBanner(null);
      await load(club.slug, club.mode ?? undefined);
    } catch (err) {
      setActionErrorKey(formErrorKey(err));
      // The application may have been decided meanwhile: show the current state.
      if (err instanceof ApiError && err.status === 409) await load(club.slug, club.mode ?? undefined);
    } finally {
      setWithdrawBusy(false);
    }
  };

  const confirmWithdraw = (id: string) => {
    Alert.alert(t('forms.apply.withdraw'), t('forms.apply.withdraw.confirm'), [
      { text: t('ui.cancel'), style: 'cancel' },
      { text: t('forms.apply.withdraw.yes'), style: 'destructive', onPress: () => void doWithdraw(id) },
    ]);
  };

  const handleSubmitted = (result: SubmittedResult) => {
    if (!club) return;
    const warnings = result.warnings.map(childWarningKey).filter((k): k is string => k !== null);
    markSubmitted(result.submission);
    setBanner({ warnings });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    void load(club.slug, club.mode ?? undefined, true);
  };

  const handleConflict = (kind: ApplyConflict) => {
    if (kind !== 'other') setConflict(kind);
  };

  const handleBlocked = () => setServerBlocked(true);

  const resend = async () => {
    if (!user?.email || resendState === 'sending') return;
    setResendState('sending');
    const result = await resendVerificationEmail(user.email);
    setResendState(result.success ? 'sent' : 'failed');
  };

  const recheckVerification = async () => {
    setChecking(true);
    try {
      await refetchSession();
      setServerBlocked(false);
    } finally {
      setChecking(false);
    }
  };

  const handleDiscarded = () => {
    if (club) void load(club.slug, club.mode ?? undefined);
  };

  if (conflict) {
    const key = CONFLICT_KEY[conflict];
    return (
      <KeyboardAwareScreen
        className="bg-muted dark:bg-muted-dark"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }}
      >
        <View className="bg-card dark:bg-card-dark p-6 rounded-2xl items-center" accessibilityLiveRegion="polite">
          <Text className="text-xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark">
            {t(`join-club.result.${key}.title`)}
          </Text>
          <Text className="text-sm text-center mb-5 text-muted-foreground dark:text-muted-foreground-dark">
            {t(`join-club.result.${key}.body`)}
          </Text>
          <TouchableOpacity
            className="bg-primary dark:bg-primary-dark rounded-lg py-3 px-6 items-center"
            style={{ minHeight: 44 }}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">{t('join-club.pending.back')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScreen>
    );
  }

  const ready = phase === 'ready' && club !== null;

  return (
    <KeyboardAwareScreen
      scrollRef={scrollRef}
      className="bg-muted dark:bg-muted-dark"
      contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 40, justifyContent: ready ? 'flex-start' : 'center' }}
    >
      <Text className="text-3xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark" accessibilityRole="header">
        {t('join-club.title')}
      </Text>
      <Text className="text-sm text-center mb-6 text-muted-foreground dark:text-muted-foreground-dark">{t('join-club.description')}</Text>

      <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
        {!ready ? (
          <>
            <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
              {t('join-club.slug.label')}
            </Text>
            <TextInput
              className={`bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border mb-2 ${
                loadErrorKey ? 'border-destructive' : 'border-border dark:border-border-dark'
              }`}
              accessibilityLabel={t('join-club.slug.label')}
              placeholder={t('forms.apply.slugPlaceholder')}
              placeholderTextColor={themeColors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              value={slug}
              editable={phase !== 'loading'}
              onChangeText={(v) => {
                slugTouched.current = true;
                setSlug(v);
              }}
              onSubmitEditing={handleLoad}
              returnKeyType="go"
            />
            {loadErrorKey ? (
              <Text className="text-destructive text-sm mb-2" accessibilityRole="alert" accessibilityLiveRegion="polite">
                {t(loadErrorKey)}
              </Text>
            ) : null}
            <TouchableOpacity
              className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center mt-1 ${phase === 'loading' || !slug.trim() ? 'opacity-70' : ''}`}
              style={{ minHeight: 48 }}
              onPress={handleLoad}
              disabled={phase === 'loading' || !slug.trim()}
              accessibilityRole="button"
              accessibilityState={{ busy: phase === 'loading' }}
            >
              {phase === 'loading' ? (
                <ActivityIndicator color={themeColors.primaryForeground} />
              ) : (
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">{t('forms.apply.load')}</Text>
              )}
            </TouchableOpacity>
            <MyApplicationsStatus
              open={applications.open}
              decided={applications.decided}
              phase={applications.phase}
              errorKey={applications.errorKey}
              disabled={phase === 'loading'}
              onOpen={(clubSlug, mode) => void openClub(clubSlug, mode)}
              onRetry={() => void reloadApplications()}
            />
          </>
        ) : (
          <>
            <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
              <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark" numberOfLines={1}>
                {t('forms.apply.club', { slug: club.slug })}
              </Text>
              <TouchableOpacity
                onPress={() => void backToSlug()}
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.otherClub')}</Text>
              </TouchableOpacity>
            </View>

            {refreshing ? (
              <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                <ActivityIndicator size="small" color={themeColors.primary} />
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.working')}</Text>
              </View>
            ) : null}
            {refreshFailed ? (
              <View className="mt-3" accessibilityRole="alert">
                <Text className="text-destructive text-sm">{t('forms.apply.refreshFailed')}</Text>
                <TouchableOpacity
                  onPress={() => void load(club.slug, club.mode ?? undefined, true)}
                  accessibilityRole="button"
                  className="self-start"
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {banner ? (
              <View
                className="mt-4 rounded-lg border border-success/40 dark:border-success-dark/40 bg-success/10 dark:bg-success-dark/10 p-3"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <CheckCircle2 size={18} color={themeColors.success} />
                  <Text className="flex-1 text-sm font-semibold text-foreground dark:text-foreground-dark">{t('forms.apply.submitted.title')}</Text>
                </View>
                <Text className="text-sm mt-1 text-foreground dark:text-foreground-dark">{t('forms.apply.submitted.body')}</Text>
                {banner.warnings.map((key) => (
                  <Text key={key} className="text-sm mt-2 text-warning dark:text-warning-dark">
                    {'• '}
                    {t(key)}
                  </Text>
                ))}
              </View>
            ) : null}

            {club.submitted.length > 0 ? (
              <View className="mt-4">
                <Text className="text-sm font-bold text-foreground dark:text-foreground-dark" accessibilityRole="header">
                  {t('forms.apply.open.title')}
                </Text>
                {club.submitted.map((s) => (
                  <View key={s.id} className="mt-2 rounded-lg border border-border dark:border-border-dark p-3">
                    <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
                      {t(s.onBehalfOf === 'guardian' ? 'forms.apply.open.forChild' : 'forms.apply.open.forSelf')}
                    </Text>
                    <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                      <Clock size={14} color={themeColors.primary} />
                      <Text className="text-xs font-semibold text-primary dark:text-primary-dark">{t('forms.apply.open.waiting')}</Text>
                    </View>
                    <Text className="text-xs mt-1 text-muted-foreground dark:text-muted-foreground-dark">
                      {t('verein.applications.submitted')}: {new Date(s.submittedAt ?? s.createdAt).toLocaleDateString(language)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => confirmWithdraw(s.id)}
                      disabled={withdrawBusy}
                      accessibilityRole="button"
                      className={`self-start mt-1 ${withdrawBusy ? 'opacity-60' : ''}`}
                      style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                      <Text className="text-destructive text-sm font-semibold">{t('forms.apply.withdraw')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {actionErrorKey ? (
                  <Text className="text-destructive text-sm mt-2" accessibilityRole="alert" accessibilityLiveRegion="polite">
                    {t(actionErrorKey)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {club.mode === null ? (
              <Text className="text-sm mt-4 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.nothingMore')}</Text>
            ) : (
              <>
                {club.modes.length > 1 ? (
                  <View className="mt-5">
                    <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.mode.label')}</Text>
                    <View className="flex-row flex-wrap mt-1" style={{ gap: 8 }} accessibilityRole="radiogroup">
                      {club.modes.map((m) => {
                        const active = club.mode === m;
                        return (
                          <TouchableOpacity
                            key={m}
                            onPress={() => void changeMode(m)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            className={`px-4 rounded-full items-center justify-center ${
                              active ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark border border-border dark:border-border-dark'
                            }`}
                            style={{ minHeight: 44 }}
                          >
                            <Text
                              className={`text-sm font-semibold ${
                                active
                                  ? 'text-primary-foreground dark:text-primary-foreground-dark'
                                  : 'text-foreground dark:text-foreground-dark'
                              }`}
                            >
                              {t(m === 'guardian' ? 'forms.apply.mode.child' : 'forms.apply.mode.self')}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                {club.mode === 'guardian' ? (
                  <View className="mt-3 rounded-lg border border-border dark:border-border-dark bg-muted/40 dark:bg-muted-dark/40 p-3">
                    <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{t('forms.apply.child.title')}</Text>
                    {(['data', 'consent', 'account'] as const).map((hint) => (
                      <Text key={hint} className="text-sm mt-1 text-muted-foreground dark:text-muted-foreground-dark">
                        {'• '}
                        {t(`forms.apply.child.hint.${hint}`)}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {club.mode === 'guardian' && (user?.emailVerified === false || serverBlocked) ? (
                  <View
                    className="mt-4 rounded-lg border border-warning/40 dark:border-warning-dark/40 bg-warning/10 dark:bg-warning-dark/10 p-3"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{t('forms.apply.unverified.title')}</Text>
                    <Text className="text-sm mt-1 text-foreground dark:text-foreground-dark">{t('forms.err.emailNotVerified')}</Text>
                    {resendState === 'sent' ? (
                      <Text className="text-sm mt-2 text-foreground dark:text-foreground-dark">{t('forms.apply.unverified.sent')}</Text>
                    ) : null}
                    {resendState === 'failed' ? <Text className="text-destructive text-sm mt-2">{t('forms.apply.unverified.failed')}</Text> : null}
                    <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => void resend()}
                        disabled={resendState === 'sending' || !user?.email}
                        accessibilityRole="button"
                        className="bg-primary dark:bg-primary-dark rounded-lg px-4 items-center justify-center"
                        style={{ minHeight: 44 }}
                      >
                        <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('forms.apply.unverified.resend')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void recheckVerification()}
                        disabled={checking}
                        accessibilityRole="button"
                        className="border border-border dark:border-border-dark rounded-lg px-4 items-center justify-center"
                        style={{ minHeight: 44 }}
                      >
                        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('forms.apply.unverified.check')}</Text>
                      </TouchableOpacity>
                      {club.modes.includes('self') ? (
                        <TouchableOpacity
                          onPress={() => void changeMode('self')}
                          accessibilityRole="button"
                          className="rounded-lg px-4 items-center justify-center"
                          style={{ minHeight: 44 }}
                        >
                          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.mode.self')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : (
                <ApplicationForm
                  key={`${club.formKey}:${club.mode}`}
                  slug={club.slug}
                  mode={club.mode}
                  current={club.definition}
                  resume={club.resume}
                  registerFlush={registerFlush}
                  onSubmitted={handleSubmitted}
                  onConflict={handleConflict}
                  onDiscarded={handleDiscarded}
                  onBlocked={handleBlocked}
                />
                )}
              </>
            )}
          </>
        )}
      </View>

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        className="items-center mt-4"
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm font-semibold">{t('join-club.pending.back')}</Text>
      </TouchableOpacity>
    </KeyboardAwareScreen>
  );
}
