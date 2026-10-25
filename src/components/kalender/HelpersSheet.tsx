import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useWards } from '@/hooks/useWards';
import { useEventHelpers } from '@/hooks/useEventHelpers';
import type { CalendarEvent } from '@/hooks/useEvents';
import {
  helperErrorKey,
  isSubjectOnShift,
  ownSwap,
  shiftTone,
  swapCandidates,
  takeableSwaps,
  totalShifts,
  type HelperShift,
  type ShiftTone,
} from '@/lib/helpers';
import { wardsOfClub } from '@/lib/eventRegistration';
import FormSheet from '@/components/ui/FormSheet';
import SubjectChips from './SubjectChips';

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  event: CalendarEvent;
}

const TONE: Record<ShiftTone, { dot: string; label: string }> = {
  understaffed: { dot: '#DC2626', label: 'help.tone.understaffed' },
  open: { dot: '#E0A100', label: 'help.tone.open' },
  full: { dot: '#43A047', label: 'help.tone.full' },
};

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

function timeRange(shift: { startsAt: string; endsAt: string }, language: string): string {
  const start = new Date(shift.startsAt);
  const end = new Date(shift.endsAt);
  const day = start.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time(start)}–${time(end)}`;
}

export default function HelpersSheet({ visible, onClose, clubId, event }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const helpers = useEventHelpers(clubId, visible ? event.id : null);
  const { wards } = useWards();
  const clubWards = wardsOfClub(wards, clubId);
  const [subject, setSubject] = useState<string | null>(null);
  const [busyShift, setBusyShift] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
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
    setError(null);
    setSwapFor(null);
    setBusyShift(null);
  }, [visible]);

  const plan = helpers.data;

  const act = async (shiftId: string, job: () => Promise<void>) => {
    if (busyShift) return;
    setBusyShift(shiftId);
    setError(null);
    try {
      await job();
      if (alive.current) setSwapFor(null);
    } catch (err) {
      if (alive.current) {
        setError(t(helperErrorKey(err)));
        // Somebody else may have been faster: show the real state.
        void helpers.reload();
      }
    } finally {
      if (alive.current) setBusyShift(null);
    }
  };

  const renderShift = (stationName: string, shift: HelperShift) => {
    const tone = shiftTone(shift);
    const on = isSubjectOnShift(shift, subject);
    const offer = ownSwap(shift, subject);
    const takeable = takeableSwaps(shift, subject);
    const busy = busyShift === shift.id;
    const candidates = swapFor === shift.id && plan ? swapCandidates(plan, shift.id, subject) : [];
    const names = shift.signups.map((s) => s.displayName).filter((n): n is string => !!n);
    return (
      <View key={shift.id} className="border border-border dark:border-border-dark rounded-xl p-3 mb-2" accessibilityLabel={`${stationName}, ${timeRange(shift, language)}`}>
        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{timeRange(shift, language)}</Text>
        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: TONE[tone].dot }} />
          <Text className="text-foreground dark:text-foreground-dark text-xs font-semibold">
            {t(TONE[tone].label)} · {t('help.filled', { filled: shift.filled, capacity: shift.capacity })}
          </Text>
        </View>
        {names.length > 0 ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{names.join(', ')}</Text> : null}

        {offer ? (
          <View className="flex-row items-center flex-wrap mt-1">
            <Text className="text-warning dark:text-warning-dark text-xs font-semibold flex-1">
              {offer.toClubMemberId ? t('help.swap.offered-to') : t('help.swap.offered')}
            </Text>
            <LinkButton label={t('help.swap.withdraw')} disabled={busy} onPress={() => void act(shift.id, () => helpers.withdrawSwap(offer.id))} />
          </View>
        ) : null}

        {takeable.map((w) => (
          <View key={w.id} className="mt-1">
            <Text className="text-foreground dark:text-foreground-dark text-xs">
              {w.toClubMemberId ? t('help.swap.for-you', { name: w.fromName ?? '—' }) : t('help.swap.open-from', { name: w.fromName ?? '—' })}
            </Text>
            <View className="flex-row flex-wrap">
              <LinkButton label={t('help.swap.accept')} disabled={busy} onPress={() => void act(shift.id, () => helpers.acceptSwap(w.id, subject))} />
              {w.toClubMemberId ? <LinkButton label={t('help.swap.decline')} disabled={busy} danger onPress={() => void act(shift.id, () => helpers.declineSwap(w.id, subject))} /> : null}
            </View>
          </View>
        ))}

        <View className="flex-row flex-wrap items-center mt-1">
          {busy ? <ActivityIndicator size="small" color={themeColors.primary} /> : null}
          {on ? (
            <>
              <LinkButton label={t('help.withdraw')} danger disabled={busy} onPress={() => void act(shift.id, () => helpers.withdraw(shift.id, subject))} />
              {!offer ? <LinkButton label={t('help.swap.start')} disabled={busy} onPress={() => setSwapFor(swapFor === shift.id ? null : shift.id)} /> : null}
            </>
          ) : (
            <LinkButton
              label={subject ? t('help.signup-ward') : t('help.signup')}
              disabled={busy || shift.full}
              onPress={() => void act(shift.id, () => helpers.signUp(shift.id, subject))}
            />
          )}
        </View>

        {swapFor === shift.id ? (
          <View className="mt-1">
            <LinkButton label={t('help.swap.give-away')} disabled={busy} onPress={() => void act(shift.id, () => helpers.offerSwap(shift.id, subject, null))} />
            {candidates.length > 0 ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs px-3">{t('help.swap.with')}</Text> : null}
            {candidates.map((c) => (
              <LinkButton key={c.clubMemberId} label={c.displayName} disabled={busy} onPress={() => void act(shift.id, () => helpers.offerSwap(shift.id, subject, c.clubMemberId))} />
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <FormSheet visible={visible} title={t('help.title', { title: event.title })} onClose={onClose} cancelLabel={t('ui.done')} error={error}>
      {helpers.loading && !plan ? (
        <View className="py-8 items-center" accessibilityLabel={t('help.loading')}>
          <ActivityIndicator color={themeColors.primary} />
        </View>
      ) : helpers.error && !plan ? (
        <View className="py-4">
          <Text className="text-destructive text-sm mb-2">{apiErrorMessage(helpers.error, t)}</Text>
          <LinkButton label={t('connection.retry')} onPress={() => void helpers.reload()} />
        </View>
      ) : plan ? (
        <View>
          {plan.cancelled ? <Text className="text-destructive text-sm font-bold mb-3">{t('termine.cancelled')}</Text> : null}

          {plan.mine.length > 0 ? (
            <View className="border border-primary dark:border-primary-dark rounded-xl p-3 mb-3" accessibilityLiveRegion="polite">
              <Text className="text-foreground dark:text-foreground-dark text-sm font-bold mb-1">{t('help.mine')}</Text>
              {plan.mine.map((m) => (
                <Text key={m.signupId} className="text-foreground dark:text-foreground-dark text-sm">
                  {m.stationName} · {timeRange(m, language)}
                </Text>
              ))}
            </View>
          ) : null}

          <SubjectChips wards={clubWards} value={subject} onChange={setSubject} disabled={!!busyShift} />

          {totalShifts(plan) === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
              {plan.canManage ? t('help.empty.manage') : t('help.empty')}
            </Text>
          ) : (
            plan.stations
              .filter((s) => s.shifts.length > 0)
              .map((station) => (
                <View key={station.id} className="mb-2">
                  <Text className="text-foreground dark:text-foreground-dark text-base font-bold">{station.name}</Text>
                  {station.description ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-1">{station.description}</Text> : null}
                  <View className="mt-1">{station.shifts.map((shift) => renderShift(station.name, shift))}</View>
                </View>
              ))
          )}
        </View>
      ) : null}
    </FormSheet>
  );
}
