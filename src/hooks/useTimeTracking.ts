import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import { monthBounds, type TimeEntry, type TimeSuggestion } from '@/lib/timeTracking';
import { useScopedResource } from './useScopedResource';

/**
 * Own time stamp (`/time-entries*`, Wave 12 P2, only for members with `canTrack` (an applicable hourly rate, trainer, Abteilungsleitung, `time:write`); others get 403 `no_rate`). Report
 * only: no payout state. The running entry, this month's own entries and the proposals from attendance lists are loaded
 * while `enabled` (the sheet is open); every action re-reads all three. Nothing is persisted on the device.
 */
export function useTimeTracking(clubId: string | null, enabled: boolean, now: Date = new Date()) {
  const club = encodeURIComponent(clubId ?? '');
  const on = !!clubId && enabled;
  const { from, to } = monthBounds(now);
  const current = useScopedResource<TimeEntry | null>(on ? `/time-entries/current?clubId=${club}` : null);
  const entries = useScopedResource<TimeEntry[]>(on ? `/time-entries?clubId=${club}&scope=mine&from=${from}&to=${to}` : null);
  const suggestions = useScopedResource<TimeSuggestion[]>(on ? `/time-entries/suggestions?clubId=${club}&from=${from}&to=${to}` : null);
  const reloadCurrent = current.reload;
  const reloadEntries = entries.reload;
  const reloadSuggestions = suggestions.reload;

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadCurrent(), reloadEntries(), reloadSuggestions()]);
  }, [reloadCurrent, reloadEntries, reloadSuggestions]);

  const clockIn = useCallback(
    async (eventId?: string | null) => {
      await apiFetch(`/time-entries/clock-in?clubId=${club}`, { method: 'POST', body: eventId ? { eventId } : {} });
      await reloadAll();
    },
    [club, reloadAll],
  );

  const clockOut = useCallback(async () => {
    await apiFetch(`/time-entries/clock-out?clubId=${club}`, { method: 'POST', body: {} });
    await reloadAll();
  }, [club, reloadAll]);

  /** Takes over a proposal from an attendance list (only on this user action). */
  const fromEvent = useCallback(
    async (eventId: string) => {
      await apiFetch(`/time-entries/from-event?clubId=${club}`, { method: 'POST', body: { eventId } });
      await reloadAll();
    },
    [club, reloadAll],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      await apiFetch(`/time-entries/${encodeURIComponent(id)}?clubId=${club}`, { method: 'DELETE' });
      await reloadAll();
    },
    [club, reloadAll],
  );

  return {
    current: current.data ?? null,
    entries: entries.data ?? [],
    suggestions: suggestions.data ?? [],
    loading: entries.loading && !entries.data,
    currentLoading: current.loading,
    error: current.error ?? entries.error,
    reload: reloadAll,
    clockIn,
    clockOut,
    fromEvent,
    removeEntry,
  };
}
