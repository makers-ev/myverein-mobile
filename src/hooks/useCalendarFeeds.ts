import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { createFeedBody, type CalendarFeed, type NewCalendarFeed } from '@/lib/calendarFeeds';

/**
 * Own calendar subscription links (`GET/POST /calendar-feeds`, revoke, rotate). The list never contains the
 * token; create and rotate return it once and the caller must keep it only in component state.
 * Loads only while `enabled` (the sheet is open); only the newest list request may write state.
 */
export function useCalendarFeeds(clubId: string | null, enabled: boolean) {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);
  const club = encodeURIComponent(clubId ?? '');

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetch<{ data: CalendarFeed[] }>(`/calendar-feeds?clubId=${club}`);
      if (id === requestId.current) setFeeds(data);
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, enabled, club]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createFeed = useCallback(
    async (calendarId: string | null, label: string) => {
      const { data } = await apiFetch<{ data: NewCalendarFeed }>(`/calendar-feeds?clubId=${club}`, {
        method: 'POST',
        body: createFeedBody(calendarId, label),
      });
      await refetch();
      return data;
    },
    [club, refetch],
  );

  const revokeFeed = useCallback(
    async (feedId: string) => {
      await apiFetch(`/calendar-feeds/${encodeURIComponent(feedId)}?clubId=${club}`, { method: 'DELETE' });
      await refetch();
    },
    [club, refetch],
  );

  const rotateFeed = useCallback(
    async (feedId: string) => {
      const { data } = await apiFetch<{ data: NewCalendarFeed }>(`/calendar-feeds/${encodeURIComponent(feedId)}/rotate?clubId=${club}`, {
        method: 'POST',
      });
      await refetch();
      return data;
    },
    [club, refetch],
  );

  return { feeds, loading, error, refetch, createFeed, revokeFeed, rotateFeed };
}
