import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { isOfflineError } from '@/lib/apiErrorMessage';
import { dropOfflineClubIfDenied, getWipeGeneration, loadOffline, saveOffline } from '@/lib/offlineCache';
import { deleteSeriesQuery, type EventSeries, type SeriesPreview, type SeriesRequestOptions, type SeriesScope } from '@/lib/eventSeries';
import { cancelBody, withNotify, withNotifyQuery, type CancelPreview } from '@/lib/notifyOptions';

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  category: string | null;
  capacity: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Wave 9 B10: cancelled instead of deleted -- optional so older responses still type-check. */
  cancelled?: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  /** Wave 12 B3: all-day events show no time of day; `endsAt` is 23:59:59 local of the LAST day. Optional for older backends. */
  allDay?: boolean;
  /** Wave 12 B3: the caller's own sign-up, computed by the backend (no client-side state). */
  myRsvp?: 'angemeldet' | 'warteliste' | null;
  /** Confirmed seats / waitlist length. */
  attendeeCount?: number;
  waitlistCount?: number;
  /** Wave 12 B5: set for occurrences of a recurring event. */
  seriesId?: string | null;
  originalStartsAt?: string | null;
  /** The occurrence was edited on its own (a later "all occurrences" edit leaves it alone). */
  isOverride?: boolean;
  costNote?: string | null;
  costCents?: number | null;
}

interface EventRange {
  from?: string;
  to?: string;
}

/** The fetch client revives ISO strings into `Date`s; the app's event type carries ISO strings. */
export function normalizeEvent(raw: CalendarEvent): CalendarEvent {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
  const e = raw as unknown as Record<string, unknown>;
  for (const key of ['startsAt', 'endsAt', 'createdAt', 'updatedAt', 'cancelledAt', 'originalStartsAt']) {
    if (key in e) e[key] = iso(e[key]);
  }
  return raw;
}

/** Fetch-shaped hook for `GET /events?clubId=&from=&to=`, see README.md's "Adding a new API request". */
export function useEvents(clubId: string | null, range?: EventRange) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(!!clubId);
  const [loadError, setLoadError] = useState<unknown>(null);
  // Set while the list is the offline copy (no connection): ISO time the copy was saved. Read-only data.
  const [staleAt, setStaleAt] = useState<string | null>(null);
  // Only the latest request may write state, so a slow older month can't overwrite a newer one.
  const requestId = useRef(0);
  const from = range?.from;
  const to = range?.to;

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    const wipeGeneration = getWipeGeneration();
    if (!clubId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ clubId });
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const { data } = await apiFetch<{ data: CalendarEvent[] }>(`/events?${params.toString()}`);
      const list = Array.isArray(data) ? data.filter(Boolean).map(normalizeEvent) : [];
      if (id === requestId.current) {
        setEvents(list);
        setStaleAt(null);
        void saveOffline('events', clubId, `${from ?? ''}|${to ?? ''}`, list, wipeGeneration);
      }
    } catch (err) {
      dropOfflineClubIfDenied(err, clubId);
      // No connection: show the last copy of this range (read-only) instead of an error, when there is one.
      const copy = isOfflineError(err) ? await loadOffline<CalendarEvent[]>('events', clubId, `${from ?? ''}|${to ?? ''}`) : null;
      if (id === requestId.current) {
        setEvents(copy ? copy.payload : []);
        setStaleAt(copy ? copy.savedAt : null);
        setLoadError(copy ? null : err);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, from, to]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { events, loading, loadError, staleAt, refetch };
}

/** RSVP actions for a club's events -- kept separate so callers that only need these don't pull in the list fetch. */
export function useEventRsvp(clubId: string | null, onChanged?: () => void) {
  const rsvp = useCallback(
    async (eventId: string) => {
      const { data } = await apiFetch<{ data: { status: 'angemeldet' | 'warteliste' } }>(`/events/${eventId}/rsvp?clubId=${clubId}`, {
        method: 'POST',
      });
      onChanged?.();
      return data.status;
    },
    [clubId, onChanged],
  );

  const cancelRsvp = useCallback(
    async (eventId: string) => {
      await apiFetch(`/events/${eventId}/rsvp?clubId=${clubId}`, { method: 'DELETE' });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  return { rsvp, cancelRsvp };
}

export interface EventInput {
  calendarId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  category: string | null;
  capacity: number | null;
  allDay?: boolean;
}

/** Write actions for events (`calendars:write`), `onChanged` refetches the list. */
export function useEventMutations(clubId: string | null, onChanged?: () => void) {
  const createEvent = useCallback(
    async (input: EventInput) => {
      // POST schema has no nullable fields -- omit empty optionals instead of sending null.
      const body = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null));
      await apiFetch(`/events?clubId=${clubId}`, { method: 'POST', body });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  const updateEvent = useCallback(
    async (id: string, input: EventInput, notify = true) => {
      await apiFetch(`/events/${id}?clubId=${clubId}`, { method: 'PATCH', body: withNotify(input, notify) });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  const deleteEvent = useCallback(
    async (id: string, notify = true) => {
      await apiFetch(withNotifyQuery(`/events/${id}?clubId=${clubId}`, notify), { method: 'DELETE' });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  /** `POST /events/:id/cancel` (`calendars:write`): cancels instead of deleting, optional reason, `notify:false` suppresses. */
  const cancelEvent = useCallback(
    async (id: string, reason: string, notify = true) => {
      await apiFetch(`/events/${id}/cancel?clubId=${clubId}`, { method: 'POST', body: cancelBody(reason, notify) });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  return { createEvent, updateEvent, deleteEvent, cancelEvent };
}

/**
 * `GET /events/:id/cancel-preview` (`calendars:write`): audience counts shown before confirming a cancellation.
 * Only loads while `eventId` is set; only the newest request may write state.
 */
export function useCancelPreview(clubId: string | null, eventId: string | null) {
  const [preview, setPreview] = useState<CancelPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    setPreview(null);
    setError(null);
    if (!clubId || !eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: CancelPreview }>(`/events/${eventId}/cancel-preview?clubId=${encodeURIComponent(clubId)}`);
      if (id === requestId.current) setPreview(data);
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, eventId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { preview, loading, error, refetch };
}

export interface SeriesChange {
  affected: { updated: number; created: number; removed: number; cancelled: number };
}

export interface SeriesRemoval {
  deleted: number;
  cancelled: number;
  seriesDeleted: boolean;
}

/** Series write actions (`calendars:write`, Wave 12 M2), `onChanged` refetches the event list. */
export function useEventSeries(clubId: string | null, onChanged?: () => void) {
  const club = encodeURIComponent(clubId ?? '');

  /** `POST /event-series/preview`: nothing is stored; the first occurrences and skipped holidays. */
  const previewSeries = useCallback(
    async (body: Record<string, unknown>, limit = 10) => {
      const { data } = await apiFetch<{ data: SeriesPreview }>(`/event-series/preview?clubId=${club}&limit=${limit}`, { method: 'POST', body });
      return data;
    },
    [club],
  );

  const createSeries = useCallback(
    async (body: Record<string, unknown>) => {
      const { data } = await apiFetch<{ data: { occurrencesCreated: number; skippedHolidays: SeriesPreview['skippedHolidays'] } }>(
        `/event-series?clubId=${club}`,
        { method: 'POST', body },
      );
      onChanged?.();
      return data;
    },
    [club, onChanged],
  );

  const updateSeries = useCallback(
    async (seriesId: string, body: Record<string, unknown>) => {
      const { data } = await apiFetch<{ data: SeriesChange }>(`/event-series/${encodeURIComponent(seriesId)}?clubId=${club}`, { method: 'PATCH', body });
      onChanged?.();
      return data;
    },
    [club, onChanged],
  );

  /** `DELETE /event-series/:id?scope=`: deletes occurrences, or cancels those that have sign-ups. */
  const deleteSeries = useCallback(
    async (seriesId: string, scope: SeriesScope, eventId: string, options: SeriesRequestOptions = {}) => {
      const query = deleteSeriesQuery(clubId ?? '', scope, eventId, options);
      const { data } = await apiFetch<{ data: SeriesRemoval }>(`/event-series/${encodeURIComponent(seriesId)}?${query}`, { method: 'DELETE' });
      onChanged?.();
      return data;
    },
    [clubId, onChanged],
  );

  return { previewSeries, createSeries, updateSeries, deleteSeries };
}

/** `GET /event-series/:id`, loads only while `seriesId` is set; only the newest request may write state. */
export function useSeriesDetail(clubId: string | null, seriesId: string | null) {
  const [series, setSeries] = useState<EventSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    setSeries(null);
    setError(null);
    if (!clubId || !seriesId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: EventSeries }>(`/event-series/${encodeURIComponent(seriesId)}?clubId=${encodeURIComponent(clubId)}`);
      if (id === requestId.current) setSeries(data);
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, seriesId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { series, loading, error, refetch };
}
