import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

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
}

interface EventRange {
  from?: string;
  to?: string;
}

/** Fetch-shaped hook for `GET /events?clubId=&from=&to=`, see README.md's "Adding a new API request". */
export function useEvents(clubId: string | null, range?: EventRange) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(!!clubId);
  // Only the latest request may write state, so a slow older month can't overwrite a newer one.
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ clubId });
      if (range?.from) params.append('from', range.from);
      if (range?.to) params.append('to', range.to);
      const { data } = await apiFetch<{ data: CalendarEvent[] }>(`/events?${params.toString()}`);
      if (id === requestId.current) setEvents(data);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, range?.from, range?.to]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { events, loading, refetch };
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
    async (id: string, input: EventInput) => {
      await apiFetch(`/events/${id}?clubId=${clubId}`, { method: 'PATCH', body: input });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      await apiFetch(`/events/${id}?clubId=${clubId}`, { method: 'DELETE' });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  return { createEvent, updateEvent, deleteEvent };
}
