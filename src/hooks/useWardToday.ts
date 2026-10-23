import { useCallback, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { addDaysKey, dayKey } from '@/lib/ward';
import { useScopedResource } from './useScopedResource';

export const WARD_EVENTS_DAYS = 14;

/** One row of `GET /guardian/wards/:wardId/events`. `response` is the ward's current Zu-/Absage (null = none yet). */
export interface WardEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  category: string | null;
  locationName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  response: string | null;
  /** False for wards with an own account (they answer there) and for cancelled events. */
  canRespond: boolean;
}

export interface WardContact {
  clubMemberId: string;
  name: string;
  roleType: string;
  department: { id: string; name: string };
  /** Only present when the trainer opened that contact way for members. */
  phone: string | null;
  email: string | null;
}

export type WardAnswer = 'angemeldet' | 'abgesagt';

/**
 * Upcoming events of one ward (today + 14 days) with Zu-/Absage. An answer is applied at once and reloaded; on a
 * failure the server state comes back through the reload and the caller gets `false` to show an error.
 */
export function useWardEvents(clubId: string | null, wardId: string | null) {
  // Day keys are computed once per mount of the subject; a screen left open past midnight refreshes on pull-to-refresh.
  const range = useMemo(() => {
    const now = new Date();
    return { from: dayKey(now), to: addDaysKey(now, WARD_EVENTS_DAYS) };
  }, []);
  const path = clubId && wardId ? `/guardian/wards/${encodeURIComponent(wardId)}/events?clubId=${encodeURIComponent(clubId)}&from=${range.from}&to=${range.to}` : null;
  const { data, loading, error, reload, mutate } = useScopedResource<WardEvent[]>(path);
  const [pending, setPending] = useState<string | null>(null);

  const respond = useCallback(
    async (eventId: string, answer: WardAnswer | null): Promise<{ ok: true } | { ok: false; error: unknown }> => {
      if (!clubId || !wardId) return { ok: false, error: null };
      setPending(eventId);
      const url = `/guardian/wards/${encodeURIComponent(wardId)}/events/${encodeURIComponent(eventId)}/response?clubId=${encodeURIComponent(clubId)}`;
      mutate((rows) => rows.map((e) => (e.id === eventId ? { ...e, response: answer } : e)));
      try {
        if (answer) await apiFetch(url, { method: 'PUT', body: { status: answer } });
        else await apiFetch(url, { method: 'DELETE' });
        return { ok: true };
      } catch (err) {
        void reload();
        return { ok: false, error: err };
      } finally {
        setPending((p) => (p === eventId ? null : p));
      }
    },
    [clubId, wardId, mutate, reload],
  );

  return { events: data ?? [], loading, error, reload, respond, pending };
}

/** Trainers / department leads of the ward's departments; contact ways only as far as the backend returns them. */
export function useWardContacts(clubId: string | null, wardId: string | null) {
  const path = clubId && wardId ? `/guardian/wards/${encodeURIComponent(wardId)}/contacts?clubId=${encodeURIComponent(clubId)}` : null;
  const { data, loading, error, reload } = useScopedResource<WardContact[]>(path);
  return { contacts: data ?? [], loading, error, reload };
}
