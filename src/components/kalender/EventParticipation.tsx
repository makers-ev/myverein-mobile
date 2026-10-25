import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Share, Text, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { websiteUrl } from '@/auth/auth-client';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useWards } from '@/hooks/useWards';
import { useEventRegistration, useMyRsvp, usePublicLinkActions, useRsvpActions } from '@/hooks/useEventRegistration';
import type { CalendarEvent } from '@/hooks/useEvents';
import {
  absolutePublicLink,
  clampPartySize,
  formatCost,
  maxPartySize,
  needsDetails,
  registrationErrorKey,
  registrationFields,
  wardsOfClub,
  type MyRsvp,
  type RegistrationInfo,
} from '@/lib/eventRegistration';
import { fieldErrorsFromError, validateAnswers, type Answers, type FieldErrorCode } from '@/lib/formSchema';
import FormRenderer from '@/components/forms/FormRenderer';
import { RsvpControl, type RsvpProps } from './EventSheet';
import SubjectChips from './SubjectChips';

interface Props {
  clubId: string;
  event: CalendarEvent;
  /** The plain sign-up control, used for events without a registration setup (old behaviour). */
  fallback: RsvpProps | null;
  /** Refetch the event list (counts, `myRsvp`). */
  onChanged: () => void;
}

function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const themeColors = useThemeColors();
  const base = 'rounded-xl items-center justify-center px-4';
  const style =
    variant === 'primary'
      ? 'bg-primary dark:bg-primary-dark'
      : variant === 'danger'
        ? 'border border-border dark:border-border-dark'
        : 'border border-border dark:border-border-dark';
  const text =
    variant === 'primary'
      ? 'text-primary-foreground dark:text-primary-foreground-dark font-bold'
      : variant === 'danger'
        ? 'text-destructive font-semibold'
        : 'text-foreground dark:text-foreground-dark font-semibold';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      className={`${base} ${style} ${disabled || busy ? 'opacity-60' : ''}`}
      style={{ minHeight: 48 }}
    >
      {busy ? <ActivityIndicator size="small" color={variant === 'primary' ? themeColors.primaryForeground : themeColors.primary} /> : <Text className={`text-sm ${text}`}>{label}</Text>}
    </TouchableOpacity>
  );
}

function PartySizeStepper({ value, max, onChange, disabled }: { value: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const step = (delta: number) => onChange(Math.min(max, Math.max(1, value + delta)));
  return (
    <View className="mb-3">
      <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{t('reg.party.label')}</Text>
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1.5">{t('reg.party.hint', { max })}</Text>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={() => step(-1)}
          disabled={disabled || value <= 1}
          accessibilityRole="button"
          accessibilityLabel={t('reg.party.less')}
          className={`border border-border dark:border-border-dark rounded-xl items-center justify-center ${disabled || value <= 1 ? 'opacity-40' : ''}`}
          style={{ width: 48, height: 48 }}
        >
          <Minus size={18} color={themeColors.foreground} />
        </TouchableOpacity>
        <Text className="text-foreground dark:text-foreground-dark text-lg font-bold" accessibilityLiveRegion="polite" accessibilityLabel={t('reg.party.count', { count: value })}>
          {value}
        </Text>
        <TouchableOpacity
          onPress={() => step(1)}
          disabled={disabled || value >= max}
          accessibilityRole="button"
          accessibilityLabel={t('reg.party.more')}
          className={`border border-border dark:border-border-dark rounded-xl items-center justify-center ${disabled || value >= max ? 'opacity-40' : ''}`}
          style={{ width: 48, height: 48 }}
        >
          <Plus size={18} color={themeColors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Sign-up of one person (the caller or a ward): status, change, cancel, or the form for a new registration. */
function SubjectRegistration({
  clubId,
  event,
  info,
  subjectId,
  isWard,
  onChanged,
}: {
  clubId: string;
  event: CalendarEvent;
  info: RegistrationInfo;
  subjectId: string | null;
  isWard: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const my = useMyRsvp(clubId, event.id, subjectId);
  const { submit, cancel } = useRsvpActions(clubId);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [partySize, setPartySize] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrorCode>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const rsvp: MyRsvp | null = my.data ?? null;
  const fields = registrationFields(info.form);
  const details = needsDetails(info);
  const max = maxPartySize(info);
  const showForm = details && (open || editing);

  const begin = () => {
    setError(null);
    setNotice(null);
    setFieldErrors({});
    setPartySize(clampPartySize(rsvp?.partySize ?? 1, info));
    setAnswers(rsvp?.answers ?? {});
  };

  const send = async () => {
    if (busy) return;
    if (details) {
      const errors = validateAnswers(fields, answers, { mode: 'submit' });
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError(t('forms.err.fieldsInvalid'));
        return;
      }
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    try {
      const result = await submit(event.id, info, { partySize, answers, forClubMemberId: subjectId });
      if (!alive.current) return;
      setNotice(result.status === 'warteliste' ? t('reg.notice.waitlist') : t('reg.notice.confirmed'));
      setEditing(false);
      setOpen(false);
      onChanged();
      void my.reload();
    } catch (err) {
      if (!alive.current) return;
      setFieldErrors(fieldErrorsFromError(err) ?? {});
      setError(t(registrationErrorKey(err)));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const withdraw = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await cancel(event.id, subjectId);
      if (!alive.current) return;
      setNotice(t('reg.notice.cancelled'));
      setEditing(false);
      onChanged();
      void my.reload();
    } catch (err) {
      if (alive.current) setError(t(registrationErrorKey(err)));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (my.loading && !my.data) {
    return (
      <View className="py-3" accessibilityLabel={t('reg.loading')}>
        <ActivityIndicator />
      </View>
    );
  }

  const registered = !!rsvp && !editing;
  const closedForNew = !info.open;

  return (
    <View style={{ gap: 10 }}>
      {registered ? (
        <View style={{ gap: 8 }}>
          <Text className="text-success dark:text-success-dark text-sm font-semibold" accessibilityLiveRegion="polite">
            {rsvp.status === 'angemeldet' ? t('reg.status.confirmed') : t('reg.status.waitlist')}
            {rsvp.partySize > 1 ? ` · ${t('reg.status.persons', { count: rsvp.partySize })}` : ''}
          </Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {details && info.open ? (
              <View className="flex-1">
                <Button
                  label={t('reg.change')}
                  variant="outline"
                  onPress={() => {
                    begin();
                    setEditing(true);
                  }}
                />
              </View>
            ) : null}
            <View className="flex-1">
              <Button label={isWard ? t('reg.cancel-ward') : t('termine.cancel')} variant="danger" onPress={() => void withdraw()} busy={busy} />
            </View>
          </View>
        </View>
      ) : closedForNew && !rsvp ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
          {info.closedReason === 'deadline_passed' ? t('reg.closed.deadline') : t('reg.closed.generic')}
        </Text>
      ) : showForm ? (
        <View>
          {max > 1 ? <PartySizeStepper value={partySize} max={max} onChange={setPartySize} disabled={busy} /> : null}
          {fields.length > 0 ? (
            <FormRenderer
              fields={fields}
              privacyNotice={info.form?.privacyNotice}
              answers={answers}
              onChange={(key, value) => {
                setAnswers((prev) => {
                  const next = { ...prev };
                  if (value === undefined) delete next[key];
                  else next[key] = value;
                  return next;
                });
                setFieldErrors((prev) => {
                  if (!(key in prev)) return prev;
                  const { [key]: _removed, ...rest } = prev;
                  return rest;
                });
              }}
              errors={fieldErrors}
              disabled={busy}
            />
          ) : null}
          <View className="flex-row mt-3" style={{ gap: 8 }}>
            <View className="flex-1">
              <Button
                label={t('ui.cancel')}
                variant="outline"
                disabled={busy}
                onPress={() => {
                  setEditing(false);
                  setOpen(false);
                }}
              />
            </View>
            <View className="flex-1">
              <Button label={editing ? t('reg.save') : t('reg.submit')} onPress={() => void send()} busy={busy} />
            </View>
          </View>
        </View>
      ) : (
        <Button
          label={isWard ? t('reg.submit-ward') : t('termine.rsvp')}
          onPress={() => {
            if (details) {
              begin();
              setOpen(true);
            } else {
              void send();
            }
          }}
          busy={busy}
        />
      )}
      {notice ? (
        <Text className="text-foreground dark:text-foreground-dark text-xs" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text className="text-destructive text-sm" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Board side: create / replace / revoke the public registration link for guests without an account. */
function GuestLinkCard({ clubId, event, info, onChanged }: { clubId: string; event: CalendarEvent; info: RegistrationInfo; onChanged: () => void }) {
  const { t } = useLanguage();
  const links = usePublicLinkActions(clubId, event.id);
  const [fresh, setFresh] = useState<string | null>(null);
  const [active, setActive] = useState(!!info.manage?.publicLinkActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setActive(!!info.manage?.publicLinkActive), [info.manage?.publicLinkActive]);

  const run = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await job();
    } catch (err) {
      setMessage(t(registrationErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const link = await links.create();
      setFresh(absolutePublicLink(link.url, websiteUrl));
      setActive(true);
      onChanged();
    });
  const revoke = () =>
    run(async () => {
      await links.revoke();
      setFresh(null);
      setActive(false);
      onChanged();
    });
  const share = async () => {
    if (!fresh) return;
    try {
      await Share.share({ message: fresh });
    } catch {
      setMessage(t('feeds.share-failed'));
    }
  };
  const openLink = async () => {
    if (!fresh) return;
    try {
      await Linking.openURL(fresh);
    } catch {
      setMessage(t('feeds.share-failed'));
    }
  };

  if (!info.allowGuests) {
    return (
      <View className="border border-border dark:border-border-dark rounded-xl p-3">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-bold">{t('reg.guest.title')}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{t('reg.guest.not-allowed')}</Text>
      </View>
    );
  }

  return (
    <View className="border border-border dark:border-border-dark rounded-xl p-3" style={{ gap: 6 }}>
      <Text className="text-foreground dark:text-foreground-dark text-sm font-bold">{t('reg.guest.title')}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('reg.guest.warning')}</Text>
      {fresh ? (
        <View accessibilityLiveRegion="polite">
          <Text selectable className="text-foreground dark:text-foreground-dark text-xs mb-1">
            {fresh}
          </Text>
          <Text className="text-destructive text-xs mb-1">{t('reg.guest.once')}</Text>
          <View className="flex-row flex-wrap">
            <TouchableOpacity onPress={() => void share()} accessibilityRole="button" className="justify-center px-3" style={{ minHeight: 44 }}>
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('reg.guest.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void openLink()} accessibilityRole="button" className="justify-center px-3" style={{ minHeight: 44 }}>
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('reg.guest.open')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{active ? t('reg.guest.active') : t('reg.guest.inactive')}</Text>
      )}
      <View className="flex-row flex-wrap">
        <TouchableOpacity
          onPress={() => void create()}
          disabled={busy}
          accessibilityRole="button"
          className={`justify-center px-3 ${busy ? 'opacity-50' : ''}`}
          style={{ minHeight: 44 }}
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{active ? t('reg.guest.replace') : t('reg.guest.create')}</Text>
        </TouchableOpacity>
        {active ? (
          <TouchableOpacity
            onPress={() => void revoke()}
            disabled={busy}
            accessibilityRole="button"
            className={`justify-center px-3 ${busy ? 'opacity-50' : ''}`}
            style={{ minHeight: 44 }}
          >
            <Text className="text-destructive text-sm font-semibold">{t('reg.guest.revoke')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {message ? <Text className="text-destructive text-xs">{message}</Text> : null}
    </View>
  );
}

/**
 * Participation block of the event detail (Wave 12 M5). Without a registration setup it is the old one-tap sign-up; with
 * one it shows cost (display only), deadline, the form with party size (Wave 8 renderer), "für mein Kind" for parents and,
 * for `calendars:write`, the guest link. Everything the backend refuses (closed, full group, form errors) is explained.
 */
export default function EventParticipation({ clubId, event, fallback, onChanged }: Props) {
  const { t, language } = useLanguage();
  const reg = useEventRegistration(clubId, event.cancelled ? null : event.id);
  const { wards } = useWards();
  const clubWards = wardsOfClub(wards, clubId);
  const [subject, setSubject] = useState<string | null>(null);

  if (event.cancelled) return null;
  if (reg.loading && !reg.data) {
    return (
      <View className="py-2" accessibilityLabel={t('reg.loading')}>
        <ActivityIndicator />
      </View>
    );
  }
  const info = reg.data;
  if (!info || !info.enabled) {
    // No setup (or it could not be read): the old sign-up keeps working; parents can still sign up their children.
    const plain: RegistrationInfo = info ?? {
      eventId: event.id,
      calendarId: event.calendarId,
      enabled: false,
      open: true,
      closedReason: null,
      deadlineAt: null,
      maxCompanions: 0,
      allowGuests: false,
      costNote: null,
      costCents: null,
      form: null,
      canManage: false,
    };
    return (
      <View style={{ gap: 10 }}>
        {!info && reg.error ? (
          <View accessibilityLiveRegion="polite">
            <Text className="text-destructive text-sm">{t('reg.load-error')}</Text>
            <TouchableOpacity onPress={() => void reg.reload()} accessibilityRole="button" className="self-start justify-center" style={{ minHeight: 44 }}>
              <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <SubjectChips wards={clubWards} value={subject} onChange={setSubject} />
        {subject === null ? (
          fallback ? <RsvpControl {...fallback} /> : null
        ) : (
          <SubjectRegistration key={subject} clubId={clubId} event={event} info={plain} subjectId={subject} isWard onChanged={onChanged} />
        )}
      </View>
    );
  }

  const cost = formatCost(info.costCents, language);
  const isWard = subject !== null;
  const reloadAll = () => {
    onChanged();
    void reg.reload();
  };

  return (
    <View style={{ gap: 10 }}>
      <Text className="text-foreground dark:text-foreground-dark text-sm font-bold">{t('reg.title')}</Text>
      {cost || info.costNote ? (
        <View>
          <Text className="text-foreground dark:text-foreground-dark text-sm">
            {t('reg.cost', { cost: [cost, info.costNote].filter(Boolean).join(' · ') })}
          </Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('reg.cost.no-payment')}</Text>
        </View>
      ) : null}
      {info.deadlineAt && info.open ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {t('reg.deadline', { when: new Date(info.deadlineAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) })}
        </Text>
      ) : null}
      <SubjectChips wards={clubWards} value={subject} onChange={setSubject} />
      <SubjectRegistration key={subject ?? 'me'} clubId={clubId} event={event} info={info} subjectId={subject} isWard={isWard} onChanged={reloadAll} />
      {info.canManage && info.manage ? <GuestLinkCard clubId={clubId} event={event} info={info} onChanged={reloadAll} /> : null}
    </View>
  );
}
