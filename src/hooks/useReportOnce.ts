import { useEffect, useRef } from 'react';

/**
 * Calls `callback` once when `active` turns true for `key`, however often the caller re-renders or hands in a new callback
 * identity (the callback is read through a ref). Re-arms when `active` turns false or the key changes. Used for "the link
 * ended: reload the wards", where the reload itself re-renders the caller.
 */
export function useReportOnce(active: boolean, key: string | null, callback: () => void): void {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  });
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !key) {
      reported.current = null;
      return;
    }
    if (reported.current === key) return;
    reported.current = key;
    cb.current();
  }, [active, key]);
}
