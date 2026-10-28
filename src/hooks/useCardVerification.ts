import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { looksLikeCardToken, readVerifyAnswer, type VerifyAnswer } from '@/lib/memberCard';

export type VerificationPhase =
  | { kind: 'scanning' }
  | { kind: 'checking' }
  | { kind: 'result'; answer: VerifyAnswer; notACard: boolean }
  | { kind: 'failed'; reason: 'offline' | 'rate' | 'forbidden' | 'generic' };

/**
 * Card check (M7). One scan at a time: the first QR read locks the scanner (a ref, so two camera callbacks in the same
 * frame cannot both start a request) until `reset()`. Text that cannot be one of our tokens is shown as "ungültig"
 * without asking the server. The scanned token lives in a ref only until the answer arrived (kept for "try again" after a
 * network failure, dropped on every other outcome and on unmount); the answer (name, photo URL) lives in this hook's
 * state only -- nothing is stored on the device, logged or put into a history. No network = a clear failure, never a guess.
 */
export function useCardVerification(clubId: string | null) {
  const [phase, setPhase] = useState<VerificationPhase>({ kind: 'scanning' });
  const locked = useRef(false);
  const token = useRef<string | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      token.current = null;
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!clubId) return;
      const gen = ++generation.current;
      setPhase({ kind: 'checking' });
      try {
        const res = await apiFetch<unknown>(`/member-cards/verify?clubId=${encodeURIComponent(clubId)}`, { method: 'POST', body: { token: text } });
        if (!alive.current || gen !== generation.current) return;
        token.current = null;
        setPhase({ kind: 'result', answer: readVerifyAnswer(res), notACard: false });
      } catch (err) {
        if (!alive.current || gen !== generation.current) return;
        if (!(err instanceof ApiError) || err.status === 0) {
          setPhase({ kind: 'failed', reason: 'offline' });
          return;
        }
        token.current = null;
        setPhase({ kind: 'failed', reason: err.status === 429 ? 'rate' : err.status === 403 || err.status === 401 ? 'forbidden' : 'generic' });
      }
    },
    [clubId],
  );

  const onScan = useCallback(
    (text: string) => {
      if (locked.current) return;
      locked.current = true;
      if (!looksLikeCardToken(text)) {
        setPhase({ kind: 'result', answer: { result: 'ungueltig', checkedAt: '' }, notACard: true });
        return;
      }
      token.current = text;
      void send(text);
    },
    [send],
  );

  const retry = useCallback(() => {
    if (token.current) void send(token.current);
  }, [send]);

  const reset = useCallback(() => {
    generation.current++;
    token.current = null;
    locked.current = false;
    setPhase({ kind: 'scanning' });
  }, []);

  return { phase, onScan, retry, reset, canRetry: phase.kind === 'failed' && phase.reason === 'offline' };
}
