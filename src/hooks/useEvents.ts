import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
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

  const refetch = useCallback(async () => {
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
      setEvents(data);
    } finally {
      setLoading(false);
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
      const { status } = await apiFetch<{ status: 'angemeldet' | 'warteliste' }>(`/events/${eventId}/rsvp?clubId=${clubId}`, {
        method: 'POST',
      });
      onChanged?.();
      return status;
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
