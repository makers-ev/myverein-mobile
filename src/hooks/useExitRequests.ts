import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

export type ExitKind = 'cancellation' | 'exclusion';
export type ExitStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** Request shape of `/club-exit-requests` (stable backend contract). Dates are `YYYY-MM-DD`. */
export interface ExitRequest {
  id: string;
  clubMemberId: string;
  memberName: string | null;
  hasAccount: boolean;
  kind: ExitKind;
  status: ExitStatus;
  requestedBy: string;
  requestedOn: string;
  desiredEffectiveOn: string | null;
  effectiveOn: string | null;
  earliestEffectiveOn: string | null;
  proposedEffectiveOn: string | null;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface ExitChecklist {
  openLoans: { id: string; itemId: string; itemName: string; borrowedAt: string; dueAt: string | null; overdue: boolean }[];
  keys: { id: string; locationId: string; locationName: string }[];
  isEmpty: boolean;
}

export type ExitRequestDetail = ExitRequest & { checklist: ExitChecklist };

export interface ExitPreview {
  requestedOn: string;
  noticePeriodDays: number | null;
  noticeMode: 'month_end' | 'quarter_end' | 'year_end' | 'immediate' | null;
  earliestEffectiveOn: string;
}

const q = (clubId: string) => `clubId=${encodeURIComponent(clubId)}`;

/**
 * Own exit requests (`GET /club-exit-requests/mine`) plus the notice preview
 * (`GET /club-exit-requests/preview`), and the member's mutations: file a
 * cancellation and withdraw it. Data is kept together with its club; only the
 * newest request may write state.
 */
export function useMyExitRequests(clubId: string | null) {
  const [stored, setStored] = useState<{ clubId: string; requests: ExitRequest[]; preview: ExitPreview | null } | null>(null);
  const [loading, setLoading] = useState(!!clubId);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [mine, preview] = await Promise.all([
        apiFetch<{ data: ExitRequest[] }>(`/club-exit-requests/mine?${q(clubId)}`),
        // The hint is optional: without it the form still works, the backend clamps the date anyway.
        apiFetch<{ data: ExitPreview }>(`/club-exit-requests/preview?${q(clubId)}`).then((r) => r.data).catch(() => null),
      ]);
      if (id === requestId.current) setStored({ clubId, requests: mine.data, preview });
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const submit = useCallback(
    async (input: { desiredEffectiveOn: string | null; reason: string }) => {
      if (!clubId) throw new Error('no club');
      const body: Record<string, string> = {};
      if (input.desiredEffectiveOn) body.desiredEffectiveOn = input.desiredEffectiveOn;
      if (input.reason.trim()) body.reason = input.reason.trim();
      const res = await apiFetch<{ data: ExitRequest & { adjustedToEarliest: boolean } }>(`/club-exit-requests?${q(clubId)}`, {
        method: 'POST',
        body,
      });
      await refetch();
      return res.data;
    },
    [clubId, refetch],
  );

  const withdraw = useCallback(
    async (requestIdToWithdraw: string) => {
      if (!clubId) throw new Error('no club');
      await apiFetch(`/club-exit-requests/${encodeURIComponent(requestIdToWithdraw)}/withdraw?${q(clubId)}`, { method: 'POST', body: {} });
      await refetch();
    },
    [clubId, refetch],
  );

  const current = stored && stored.clubId === clubId ? stored : null;
  return { requests: current?.requests ?? [], preview: current?.preview ?? null, loaded: !!current, loading, error, refetch, submit, withdraw };
}

/**
 * Board queue (`GET /club-exit-requests?status=pending`, needs `members:write`)
 * with the decision mutations. Pass `enabled=false` for everybody else so no
 * request (and no 403) is made.
 */
export function useExitRequestQueue(clubId: string | null, enabled: boolean) {
  const [stored, setStored] = useState<{ clubId: string; requests: ExitRequest[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data } = await apiFetch<{ data: ExitRequest[] }>(`/club-exit-requests?${q(clubId)}&status=pending`);
      if (id === requestId.current) setStored({ clubId, requests: data });
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadDetail = useCallback(
    async (id: string): Promise<ExitRequestDetail> => {
      if (!clubId) throw new Error('no club');
      const { data } = await apiFetch<{ data: ExitRequestDetail }>(`/club-exit-requests/${encodeURIComponent(id)}?${q(clubId)}`);
      return data;
    },
    [clubId],
  );

  // A decided request leaves the queue; invalidate in-flight fetches that still contain it.
  const dropLocally = useCallback(
    (id: string) => {
      requestId.current++;
      setLoading(false);
      setStored((prev) => (prev && prev.clubId === clubId ? { ...prev, requests: prev.requests.filter((r) => r.id !== id) } : prev));
    },
    [clubId],
  );

  const approve = useCallback(
    async (id: string, input: { effectiveOn?: string; note?: string }) => {
      if (!clubId) throw new Error('no club');
      const body: Record<string, string> = {};
      if (input.effectiveOn) body.effectiveOn = input.effectiveOn;
      if (input.note?.trim()) body.note = input.note.trim();
      await apiFetch(`/club-exit-requests/${encodeURIComponent(id)}/approve?${q(clubId)}`, { method: 'POST', body });
      dropLocally(id);
    },
    [clubId, dropLocally],
  );

  const reject = useCallback(
    async (id: string, note: string) => {
      if (!clubId) throw new Error('no club');
      await apiFetch(`/club-exit-requests/${encodeURIComponent(id)}/reject?${q(clubId)}`, { method: 'POST', body: { note: note.trim() } });
      dropLocally(id);
    },
    [clubId, dropLocally],
  );

  const current = enabled && stored && stored.clubId === clubId ? stored : null;
  return { requests: current?.requests ?? [], loaded: !!current, loading, error, refetch, loadDetail, approve, reject };
}

/** `error.details.code` of a failed exit call (`exit_request_pending`, `exit_already_scheduled`, `owner_protected`, `self_approval`, ...). */
export function exitErrorCode(err: unknown): string | null {
  const details = (err as { details?: unknown } | null)?.details;
  if (details && typeof details === 'object' && 'code' in details && typeof (details as { code: unknown }).code === 'string') {
    return (details as { code: string }).code;
  }
  return null;
}

/** Formats a `YYYY-MM-DD` date for display (local calendar day, no timezone shift). */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(`${value.slice(0, 10)}T00:00`).toLocaleDateString();
}
