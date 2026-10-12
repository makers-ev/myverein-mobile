import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a stable function that calls `fn` at most once per `intervalMs`: the first call runs immediately,
 * calls inside the window schedule one trailing run. Used to refetch signed image URLs when several images
 * expire at once.
 */
export function useThrottledCallback(fn: () => void, intervalMs: number): () => void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(() => {
    const wait = intervalMs - (Date.now() - last.current);
    if (wait > 0) {
      if (!timer.current) {
        timer.current = setTimeout(() => {
          timer.current = null;
          last.current = Date.now();
          fnRef.current();
        }, wait);
      }
      return;
    }
    last.current = Date.now();
    fnRef.current();
  }, [intervalMs]);
}
