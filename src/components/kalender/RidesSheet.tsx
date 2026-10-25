import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useWards } from '@/hooks/useWards';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useEventRides } from '@/hooks/useEventRides';
import type { CalendarEvent } from '@/hooks/useEvents';
import {
  createRideBody,
  requestOf,
  rideDraftProblem,
  rideErrorKey,
  RIDE_NOTE_MAX,
  RIDE_PLACE_MAX,
  RIDE_SEATS_MAX,
  type Ride,
  type RideDraft,
} from '@/lib/rides';
import { wardsOfClub } from '@/lib/eventRegistration';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import DateTimeField from '@/components/ui/DateTimeField';
import SubjectChips from './SubjectChips';

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  event: CalendarEvent;
}

function LinkButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`justify-center px-3 ${disabled ? 'opacity-50' : ''}`}
      style={{ minHeight: 44 }}
    >
      <Text className={`text-sm font-semibold ${danger ? 'text-destructive' : 'text-primary dark:text-primary-dark'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

const EMPTY_DRAFT: RideDraft = { seats: 3, place: '', departureAt: null, note: '' };

/** Ride sharing of an event (Wave 12 P2): offer a ride, ask for a seat (parents for their children), the driver decides. */
export default function RidesSheet({ visible, onClose, clubId, event }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const rides = useEventRides(clubId, visible ? event.id : null);
  const { membership } = useOwnMembership(clubId);
  const { wards } = useWards();
  const clubWards = wardsOfClub(wards, clubId);
  const [subject, setSubject] = useState<string | null>(null);
  const [offering, setOffering] = useState(false);
  const [draft, setDraft] = useState<RideDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (visible) return;
    setSubject(null);
    setOffering(false);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setBusy(null);
  }, [visible]);

  const run = async (key: string, job: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(key);
    setError(null);
    try {
      await job();
      return true;
    } catch (err) {
      if (alive.current) {
        setError(t(rideErrorKey(err)));
        void rides.reload();
      }
      return false;
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const submitOffer = async () => {
    const problem = rideDraftProblem(draft);
    if (problem) {
      setError(t(problem === 'place' ? 'ride.form.place-required' : 'ride.form.seats-invalid'));
      return;
    }
    const ok = await run('offer', () => rides.offer(createRideBody(draft)));
    if (ok && alive.current) {
      setOffering(false);
      setDraft(EMPTY_DRAFT);
    }
  };

  const callerId = membership?.clubMemberId ?? null;

  const renderRide = (ride: Ride) => {
    const own = requestOf(ride, subject, callerId);
    const key = ride.id;
    return (
      <View key={ride.id} className="border border-border dark:border-border-dark rounded-xl p-3 mb-2">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-bold">
          {ride.mine ? t('ride.mine') : (ride.driver.displayName ?? t('ride.driver-unknown'))}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">
          {t('ride.seats', { free: ride.seatsFree, total: ride.seats })}
          {ride.departureAt ? ` · ${new Date(ride.departureAt).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' })}` : ''}
        </Text>
        {ride.placeHidden ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{t('ride.place-hidden')}</Text>
        ) : (
          <>
            {ride.departurePlace ? <Text className="text-foreground dark:text-foreground-dark text-sm mt-1">{t('ride.from', { place: ride.departurePlace })}</Text> : null}
            {ride.note ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{ride.note}</Text> : null}
          </>
        )}

        {ride.mine ? (
          <View className="mt-1">
            {(ride.requests ?? []).length === 0 ? (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('ride.no-requests')}</Text>
            ) : (
              (ride.requests ?? []).map((r) => (
                <View key={r.requestId} className="mt-1">
                  <Text className="text-foreground dark:text-foreground-dark text-sm">
                    {r.displayName ?? '—'} · {t(`ride.status.${r.status}`)}
                  </Text>
                  <View className="flex-row flex-wrap">
                    {r.status !== 'zugesagt' ? (
                      <LinkButton label={t('ride.accept')} disabled={!!busy} onPress={() => void run(r.requestId, () => rides.decide(ride.id, r.requestId, 'zugesagt'))} />
                    ) : null}
                    {r.status === 'angefragt' ? (
                      <LinkButton label={t('ride.decline')} danger disabled={!!busy} onPress={() => void run(r.requestId, () => rides.decide(ride.id, r.requestId, 'abgelehnt'))} />
                    ) : null}
                    <LinkButton label={t('ride.remove')} danger disabled={!!busy} onPress={() => void run(r.requestId, () => rides.removeRequest(ride.id, r.requestId))} />
                  </View>
                </View>
              ))
            )}
            <LinkButton label={t('ride.delete')} danger disabled={!!busy} onPress={() => void run(key, () => rides.removeRide(ride.id))} />
          </View>
        ) : own ? (
          <View className="flex-row items-center flex-wrap mt-1">
            <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold flex-1" accessibilityLiveRegion="polite">
              {t(`ride.status.${own.status}`)}
            </Text>
            <LinkButton label={own.status === 'zugesagt' ? t('ride.leave') : t('ride.withdraw')} danger disabled={!!busy} onPress={() => void run(own.requestId, () => rides.removeRequest(ride.id, own.requestId))} />
          </View>
        ) : (
          <LinkButton
            label={subject ? t('ride.request-ward') : t('ride.request')}
            disabled={!!busy || ride.seatsFree <= 0}
            onPress={() => void run(key, () => rides.requestSeat(ride.id, subject))}
          />
        )}
        {busy === key ? <ActivityIndicator size="small" color={themeColors.primary} /> : null}
      </View>
    );
  };

  const stepper = (delta: number) => setDraft((d) => ({ ...d, seats: Math.min(RIDE_SEATS_MAX, Math.max(1, d.seats + delta)) }));

  return (
    <FormSheet
      visible={visible}
      title={t('ride.title', { title: event.title })}
      onClose={onClose}
      cancelLabel={t('ui.done')}
      onSubmit={offering ? () => void submitOffer() : undefined}
      submitLabel={t('ride.offer.submit')}
      saving={busy === 'offer'}
      error={error}
    >
      {rides.loading && !rides.data ? (
        <View className="py-8 items-center" accessibilityLabel={t('ride.loading')}>
          <ActivityIndicator color={themeColors.primary} />
        </View>
      ) : rides.error && !rides.data ? (
        <View className="py-4">
          <Text className="text-destructive text-sm mb-2">{apiErrorMessage(rides.error, t)}</Text>
          <LinkButton label={t('connection.retry')} onPress={() => void rides.reload()} />
        </View>
      ) : rides.data ? (
        <View>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('ride.privacy')}</Text>
          {offering ? (
            <View>
              <Field label={t('ride.form.seats')}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <TouchableOpacity onPress={() => stepper(-1)} accessibilityRole="button" accessibilityLabel={t('reg.party.less')} className="border border-border dark:border-border-dark rounded-xl items-center justify-center" style={{ width: 48, height: 48 }}>
                    <Minus size={18} color={themeColors.foreground} />
                  </TouchableOpacity>
                  <Text className="text-foreground dark:text-foreground-dark text-lg font-bold">{draft.seats}</Text>
                  <TouchableOpacity onPress={() => stepper(1)} accessibilityRole="button" accessibilityLabel={t('reg.party.more')} className="border border-border dark:border-border-dark rounded-xl items-center justify-center" style={{ width: 48, height: 48 }}>
                    <Plus size={18} color={themeColors.foreground} />
                  </TouchableOpacity>
                </View>
              </Field>
              <Field label={t('ride.form.place')}>
                <TextInput
                  className={inputClassName}
                  value={draft.place}
                  onChangeText={(place) => setDraft((d) => ({ ...d, place }))}
                  maxLength={RIDE_PLACE_MAX}
                  placeholder={t('ride.form.place-placeholder')}
                  placeholderTextColor={themeColors.mutedForeground}
                  accessibilityLabel={t('ride.form.place')}
                />
              </Field>
              <Field label={t('ride.form.time')}>
                <DateTimeField value={draft.departureAt} onChange={(departureAt) => setDraft((d) => ({ ...d, departureAt }))} clearable placeholder={t('ride.form.time-placeholder')} />
              </Field>
              <Field label={t('ride.form.note')}>
                <TextInput
                  className={inputClassName}
                  value={draft.note}
                  onChangeText={(note) => setDraft((d) => ({ ...d, note }))}
                  maxLength={RIDE_NOTE_MAX}
                  multiline
                  style={{ minHeight: 60, textAlignVertical: 'top' }}
                  placeholderTextColor={themeColors.mutedForeground}
                  accessibilityLabel={t('ride.form.note')}
                />
              </Field>
              <LinkButton label={t('ui.cancel')} onPress={() => setOffering(false)} />
            </View>
          ) : (
            <View>
              <SubjectChips wards={clubWards} value={subject} onChange={setSubject} disabled={!!busy} />
              {rides.data.rides.length === 0 ? (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-2">{t('ride.empty')}</Text>
              ) : (
                rides.data.rides.map(renderRide)
              )}
              <TouchableOpacity
                onPress={() => setOffering(true)}
                accessibilityRole="button"
                className="bg-primary dark:bg-primary-dark rounded-xl items-center justify-center mt-2"
                style={{ minHeight: 48 }}
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('ride.offer')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
    </FormSheet>
  );
}
