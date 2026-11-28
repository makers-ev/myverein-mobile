import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import { hintFailure, hintRequest, type AvailabilityHints, type HintFailure, type HintInput } from '@/lib/availabilityHints';

export const HINT_DEBOUNCE_MS = 500;

interface Result {
  path: string;
  data?: AvailabilityHints;
  failure?: HintFailure;
}

/**
 * Debounced "Wer hat Zeit?" request. Only the newest request may write (older answers are dropped), the last answer stays
 * while a new one is on its way, and nothing is persisted. `enabled = false` sends nothing.
 */
export function useAvailabilityHints(input: HintInput, enabled: boolean) {
  const { isAuthenticated } = useAuth();
  const request = hintRequest(input);
  const path = enabled && isAuthenticated && request.kind === 'query' ? request.path : null;
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!path) return;
    const id = ++latest.current;
    const timer = setTimeout(() => {
      apiFetch<{ data: AvailabilityHints }>(path)
        .then((res) => {
          if (id === latest.current) setResult({ path, data: res.data });
        })
        .catch((err) => {
          if (id === latest.current) setResult({ path, failure: hintFailure(err) });
        });
    }, HINT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      // Invalidate: an answer for the previous inputs must not show up after they changed.
      latest.current++;
    };
  }, [path, attempt]);

  const retry = useCallback(() => {
    setResult(null);
    setAttempt((n) => n + 1);
  }, []);

  const current = result && result.path === path ? result : null;
  return {
    skip: enabled && request.kind === 'skip' ? request.reason : null,
    /** 403: the section does not exist for this user. */
    forbidden: result?.failure === 'forbidden',
    loading: path !== null && current === null,
    failure: current?.failure ?? null,
    /** The last answer stays visible (dimmed by the caller) while a new one loads. */
    data: (current ?? result)?.data ?? null,
    retry,
  };
}
