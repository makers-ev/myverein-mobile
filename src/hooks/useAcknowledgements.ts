import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import type { AcknowledgementDetail, MyAcknowledgement } from '@/lib/acknowledgements';
import { useScopedResource } from './useScopedResource';

const clubQuery = (clubId: string) => `clubId=${encodeURIComponent(clubId)}`;

export const ACK_PAGE_SIZE = 50;

interface AckPage {
  data: MyAcknowledgement[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * The caller's confirmation requests in one club (`GET /acknowledgements/mine`), including those for children when the
 * caller is a guardian. Pages of 50: `reload` fetches page 1, `loadMore` appends the next (no duplicates). Every request
 * carries a sequence number and its club, so a late answer for another club or an older request never lands; a failed
 * request keeps the list that is already there and exposes `error` (the screen shows it next to the list).
 * `openCount` counts the open, answerable requests that are loaded; `hasMore` tells the count may be higher.
 */
export function useAcknowledgements(clubId: string | null) {
  const { isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!clubId;
  const [stored, setStored] = useState<{ clubId: string; items: MyAcknowledgement[]; total: number; page: number } | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (page: number, append: boolean): Promise<boolean> => {
      const id = ++requestId.current;
      if (!enabled || !clubId) {
        setStored(null);
        setLoading(false);
        return false;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<AckPage>(`/acknowledgements/mine?${clubQuery(clubId)}&page=${page}&pageSize=${ACK_PAGE_SIZE}`);
        if (id !== requestId.current) return false;
        setStored((prev) => ({
          clubId,
          items: append && prev && prev.clubId === clubId ? [...prev.items, ...res.data.filter((a) => !prev.items.some((p) => p.id === a.id))] : res.data,
          total: res.total,
          page: res.page,
        }));
        return true;
      } catch (err) {
        if (id === requestId.current) setError(err);
        return false;
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [enabled, clubId],
  );

  useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  const current = stored && stored.clubId === clubId ? stored : null;
  const items = current?.items ?? null;
  const hasMore = !!current && current.items.length < current.total;
  const loadMore = useCallback(() => {
    if (current && hasMore && !loading) void fetchPage(current.page + 1, true);
  }, [current, hasMore, loading, fetchPage]);
  const reload = useCallback(() => fetchPage(1, false), [fetchPage]);
  const openCount = items ? items.filter((a) => a.status === 'offen' && a.canAnswer).length : 0;
  return { items, total: current?.total ?? 0, loading, error, reload, loadMore, hasMore, openCount };
}

export function useAcknowledgementDetail(clubId: string | null, id: string | null) {
  return useScopedResource<AcknowledgementDetail>(clubId && id ? `/acknowledgements/${encodeURIComponent(id)}?${clubQuery(clubId)}` : null);
}

export type AcknowledgementDecision = 'bestaetigt' | 'abgelehnt';

/**
 * Gives the answer (`POST /acknowledgements/:id/confirm`, idempotent on the server). One answer at a time: a second tap
 * while busy is ignored. The password (re-authentication) is only passed through, never kept in state or logged.
 * Returns `null` on success, otherwise the raw failure.
 */
export function useConfirmAcknowledgement(clubId: string | null) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const confirm = useCallback(
    async (id: string, decision: AcknowledgementDecision, password?: string): Promise<{ error: unknown } | null | undefined> => {
      if (!clubId || running.current) return undefined;
      running.current = true;
      setBusy(true);
      try {
        await apiFetch(`/acknowledgements/${encodeURIComponent(id)}/confirm?${clubQuery(clubId)}`, {
          method: 'POST',
          body: password ? { decision, password } : { decision },
        });
        return null;
      } catch (error) {
        return { error };
      } finally {
        running.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [clubId],
  );

  return { confirm, busy };
}
