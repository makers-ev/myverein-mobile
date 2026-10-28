import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { AcknowledgementDetail, MyAcknowledgement } from '@/lib/acknowledgements';
import { useScopedResource } from './useScopedResource';

const clubQuery = (clubId: string) => `clubId=${encodeURIComponent(clubId)}`;

/**
 * The caller's confirmation requests in one club (`GET /acknowledgements/mine`), including those for children when the
 * caller is a guardian. Kept with its path (a club switch never shows another club's list), newest request wins.
 */
export function useAcknowledgements(clubId: string | null) {
  const { data, loading, error, reload } = useScopedResource<MyAcknowledgement[]>(clubId ? `/acknowledgements/mine?${clubQuery(clubId)}&pageSize=100` : null);
  const openCount = data ? data.filter((a) => a.status === 'offen' && a.canAnswer).length : 0;
  return { items: data, loading, error, reload, openCount };
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
