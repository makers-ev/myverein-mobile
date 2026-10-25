import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  applyChange,
  applyPending,
  buildPutBody,
  cleanGuestName,
  isRetryableStatus,
  markAllPresentChanges,
  retryDelayMs,
  type AttendanceStatus,
  type AttendanceView,
} from '@/lib/attendance';
import { createSerialQueue } from '@/lib/serialQueue';

export type AttendanceSyncProblem = 'network' | 'reason_required' | 'rejected';

function detailsCode(err: unknown): string | null {
  const code = err instanceof ApiError ? (err.details as { code?: unknown } | undefined)?.code : null;
  return typeof code === 'string' ? code : null;
}

/**
 * Attendance list of one event (`/events/:id/attendance`, Wave 12 M4). Taps are applied locally at once and buffered;
 * the buffer is sent as ONE batch `PUT` (debounced, strictly one request at a time) and re-sent with a growing delay
 * after a short network break -- the same status again is idempotent on the server. A server answer never undoes taps
 * that are still buffered. Loads only while `eventId` is set; only the newest load may write. Nothing is persisted or
 * logged (names of children are personal data): closing the sheet with unsent changes loses them, the sheet warns.
 */
export function useEventAttendance(clubId: string | null, eventId: string | null) {
  const [view, setView] = useState<AttendanceView | null>(null);
  const [loading, setLoading] = useState(!!clubId && !!eventId);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [unsent, setUnsent] = useState(0);
  const [problem, setProblem] = useState<AttendanceSyncProblem | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const viewRef = useRef<AttendanceView | null>(null);
  const pending = useRef(new Map<string, AttendanceStatus | null>());
  const reasonRef = useRef('');
  const requestId = useRef(0);
  const [enqueue] = useState(createSerialQueue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const alive = useRef(true);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const base = eventId && clubId ? `/events/${encodeURIComponent(eventId)}/attendance` : null;
  const query = `clubId=${encodeURIComponent(clubId ?? '')}`;

  const commit = useCallback((next: AttendanceView | null) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const load = useCallback(async () => {
    const id = ++requestId.current;
    if (!base) {
      commit(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await apiFetch<{ data: AttendanceView }>(`${base}?${query}`);
      if (id === requestId.current && alive.current) commit(applyPending(data, pending.current));
    } catch (err) {
      if (id === requestId.current && alive.current) setLoadError(err);
    } finally {
      if (id === requestId.current && alive.current) setLoading(false);
    }
  }, [base, query, commit]);

  useEffect(() => {
    alive.current = true;
    pending.current = new Map();
    attempt.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnsent(0);
    setProblem(null);
    commit(null);
    void load();
    return () => {
      alive.current = false;
      clearTimer();
    };
  }, [load, commit]);

  /** Sends the buffer as one batch. Runs inside the serial queue; resolves when the buffer was handled (sent or kept). */
  const flush = useCallback((): Promise<void> => {
    return enqueue(async () => {
      if (!base) return;
      const snapshot = new Map(pending.current);
      const body = buildPutBody(snapshot, reasonRef.current);
      if (!body) {
        pending.current.clear();
        if (alive.current) setUnsent(0);
        return;
      }
      try {
        const { data } = await apiFetch<{ data: AttendanceView }>(`${base}?${query}`, { method: 'PUT', body });
        for (const [key, status] of snapshot) if (pending.current.get(key) === status) pending.current.delete(key);
        attempt.current = 0;
        if (!alive.current) return;
        setUnsent(pending.current.size);
        setProblem(null);
        commit(applyPending(data, pending.current));
      } catch (err) {
        if (!alive.current) return;
        const status = err instanceof ApiError ? err.status : null;
        if (isRetryableStatus(status)) {
          setProblem('network');
          clearTimer();
          timer.current = setTimeout(() => void flushRef.current(), retryDelayMs(attempt.current++));
        } else if (detailsCode(err) === 'reason_required') {
          // The list was closed meanwhile: keep the taps until a reason is entered.
          setProblem('reason_required');
        } else {
          // Rejected for good (unknown member, cancelled event, no right): drop the taps and show the real state.
          for (const key of snapshot.keys()) pending.current.delete(key);
          setUnsent(pending.current.size);
          setProblem('rejected');
          void load();
        }
      }
    });
  }, [base, enqueue, load, query, commit]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const schedule = useCallback(
    (delay = 400) => {
      clearTimer();
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  const setStatus = useCallback(
    (key: string, status: AttendanceStatus | null) => {
      const prev = viewRef.current;
      if (!prev || !prev.canWrite) return;
      commit(applyChange(prev, key, status));
      pending.current.set(key, status);
      setUnsent(pending.current.size);
      attempt.current = 0;
      schedule();
    },
    [schedule, commit],
  );

  const markAllPresent = useCallback(() => {
    const prev = viewRef.current;
    if (!prev || !prev.canWrite) return;
    let next = prev;
    for (const c of markAllPresentChanges(prev)) {
      next = applyChange(next, c.key, c.status);
      pending.current.set(c.key, c.status);
    }
    commit(next);
    setUnsent(pending.current.size);
    attempt.current = 0;
    schedule(150);
  }, [schedule, commit]);

  /** The correction reason of a closed list; sent with the next batch. Re-tries a batch that waited for it. */
  const setReason = useCallback(
    (reason: string) => {
      reasonRef.current = reason;
      if (problem === 'reason_required' && reason.trim()) {
        setProblem(null);
        schedule(0);
      }
    },
    [problem, schedule],
  );

  /** Resends right away (manual retry of the banner). */
  const retryNow = useCallback(() => {
    attempt.current = 0;
    clearTimer();
    void flush();
  }, [flush]);

  const run = useCallback(
    async (job: () => Promise<AttendanceView>) => {
      if (!base) return false;
      setBusy(true);
      setActionError(null);
      try {
        await flush();
        const next = await job();
        if (alive.current) commit(applyPending(next, pending.current));
        return true;
      } catch (err) {
        if (alive.current) setActionError(err);
        return false;
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [base, flush, commit],
  );

  /** Adds a guest / trial person by name (present right away); needs the answer for the new id, so it is not buffered. */
  const addGuest = useCallback(
    (rawName: string) => {
      const name = cleanGuestName(rawName);
      if (!name || !base) return Promise.resolve(false);
      const reason = reasonRef.current.trim();
      return run(async () => {
        const { data } = await apiFetch<{ data: AttendanceView }>(`${base}?${query}`, {
          method: 'PUT',
          body: { entries: [{ guestName: name, status: 'anwesend' }], ...(reason ? { reason } : {}) },
        });
        return data;
      });
    },
    [base, query, run],
  );

  const saveSupervisors = useCallback(
    (clubMemberIds: string[]) => {
      if (!base) return Promise.resolve(false);
      const reason = reasonRef.current.trim();
      return run(async () => {
        const { data } = await apiFetch<{ data: AttendanceView }>(`${base}/supervisors?${query}`, {
          method: 'PUT',
          body: { clubMemberIds, ...(reason ? { reason } : {}) },
        });
        return data;
      });
    },
    [base, query, run],
  );

  const closeList = useCallback(
    (markOpenAsAbsent: boolean) => {
      if (!base) return Promise.resolve(false);
      return run(async () => {
        const { data } = await apiFetch<{ data: AttendanceView }>(`${base}/close?${query}`, {
          method: 'POST',
          body: markOpenAsAbsent ? { markOpenAs: 'unentschuldigt' } : {},
        });
        return data;
      });
    },
    [base, query, run],
  );

  return {
    view,
    loading,
    loadError,
    reload: load,
    setStatus,
    markAllPresent,
    setReason,
    addGuest,
    saveSupervisors,
    closeList,
    retryNow,
    unsent,
    problem,
    actionError,
    busy,
  };
}
