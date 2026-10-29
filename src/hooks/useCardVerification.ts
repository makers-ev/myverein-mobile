import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { apiFetch, ApiError } from '@/lib/api';
import { looksLikeCardToken, readVerifyAnswer, type VerifyAnswer } from '@/lib/memberCard';

/** After "next card" the same QR is ignored for this long (the card is usually still in front of the camera). */
export const RESCAN_COOLDOWN_MS = 2500;

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
  const last = useRef<{ text: string; until: number } | null>(null);
  const lastText = useRef<string | null>(null);

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
      if (last.current && last.current.text === text && Date.now() < last.current.until) return;
      last.current = null;
      locked.current = true;
      lastText.current = text;
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

  /** Back to scanning. With `cooldown` (the "next card" button) the card just checked is not read again at once. */
  const reset = useCallback((cooldown = true) => {
    generation.current++;
    token.current = null;
    locked.current = false;
    last.current = cooldown && lastText.current ? { text: lastText.current, until: Date.now() + RESCAN_COOLDOWN_MS } : null;
    lastText.current = null;
    setPhase({ kind: 'scanning' });
  }, []);

  // A result (name, photo) must not stay on screen for the next person who picks up the phone, nor carry over to another
  // club: leave the result when the app goes to the background and when the club changes.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') reset(false);
    });
    return () => sub.remove();
  }, [reset]);
  const lastClub = useRef(clubId);
  useEffect(() => {
    if (lastClub.current !== clubId) {
      lastClub.current = clubId;
      reset(false);
    }
  }, [clubId, reset]);

  return { phase, onScan, retry, reset: () => reset(true), clear: () => reset(false), canRetry: phase.kind === 'failed' && phase.reason === 'offline' };
}
