import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';

/**
 * GET one `{ data }` resource that belongs to a subject (club + ward / member). Same fetch-shaped pattern as
 * `useClubInbox`: the data is stored together with the `path` it was loaded for (so another ward's or club's answer is
 * never shown), only the newest request may write, a failed reload keeps the last data. `path = null` disables it.
 * Nothing is logged or persisted (the payloads can be personal data).
 */
export function useScopedResource<T>(path: string | null) {
  const { isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!path;
  const [stored, setStored] = useState<{ path: string; data: T } | null>(null);
  const data = stored && stored.path === path ? stored.data : null;
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);
  const latest = useRef<Promise<T | null> | null>(null);

  const load = useCallback(
    async (id: number): Promise<T | null> => {
      if (!enabled || !path) {
        setStored(null);
        setError(null);
        setLoading(false);
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ data: T }>(path);
        if (id !== requestId.current) return latest.current ?? null;
        setStored({ path, data: res.data });
        setError(null);
        return res.data;
      } catch (err) {
        if (id === requestId.current) setError(err);
        return id === requestId.current ? null : (latest.current ?? null);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [enabled, path],
  );

  /** Resolves with the fresh data, or `null` when this (or the newest) load failed. */
  const reload = useCallback((): Promise<T | null> => {
    const id = ++requestId.current;
    const promise = load(id);
    latest.current = promise;
    return promise;
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Local (optimistic or server-confirmed) change of the loaded data; ignored while nothing is loaded for this path. */
  const mutate = useCallback(
    (fn: (prev: T) => T) => {
      setStored((prev) => (prev && prev.path === path ? { path: prev.path, data: fn(prev.data) } : prev));
    },
    [path],
  );

  return { data, loading, error, reload, mutate };
}
