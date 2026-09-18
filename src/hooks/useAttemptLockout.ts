import { useCallback, useEffect, useState } from 'react';

/**
 * Simple client-side brute-force mitigation.
 *
 * Tracks consecutive failed attempts and, once a threshold is hit, enforces
 * a temporary cooldown during which further attempts are rejected. This is
 * not a replacement for server-side rate limiting -- it only raises the
 * cost of guessing a local PIN/2FA code from the UI (unlimited instant
 * retries -> a few tries every `lockoutSeconds`).
 *
 * The state is intentionally owned by whichever component calls this hook,
 * so callers that render a modal/screen that can be closed and reopened
 * (e.g. VerifyPinModal) should lift this hook up to a parent that stays
 * mounted for the lifetime of the flow, rather than calling it inside the
 * modal itself -- otherwise closing/reopening the modal would reset it.
 */
export function useAttemptLockout(maxAttempts = 5, lockoutSeconds = 30) {
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (lockedUntil === null) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && remainingSeconds > 0;

  const registerFailure = useCallback(() => {
    setAttempts((prev) => {
      const next = prev + 1;
      if (next >= maxAttempts) {
        setLockedUntil(Date.now() + lockoutSeconds * 1000);
        return 0;
      }
      return next;
    });
  }, [maxAttempts, lockoutSeconds]);

  const registerSuccess = useCallback(() => {
    setAttempts(0);
    setLockedUntil(null);
  }, []);

  return {
    isLocked,
    remainingSeconds,
    attemptsRemaining: Math.max(0, maxAttempts - attempts),
    registerFailure,
    registerSuccess,
  };
}
