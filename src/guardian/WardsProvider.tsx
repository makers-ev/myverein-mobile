import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { apiFetch } from '@/lib/api';
import { flattenWards, wardKey, type Ward } from '@/lib/ward';

interface WardsContextValue {
  /** Live wards of the account across all clubs (`GET /my-wards`); empty for everybody else. */
  wards: Ward[];
  /** The ward the "Heute" view shows: the chosen one if still linked, else the first. */
  selected: Ward | null;
  select: (key: string) => void;
  hasWards: boolean;
  /** Has wards but no club membership of their own: no club dashboard, start on "Heute". */
  guardianOnly: boolean;
  loading: boolean;
  /** The last load failed (the previous list is kept). */
  error: boolean;
  reload: () => Promise<void>;
}

const WardsContext = createContext<WardsContextValue | null>(null);

/**
 * Single source of truth for `GET /my-wards`, shared by the Navbar (entry only with wards), the start routing and the
 * "Heute" screen. Only the newest request writes; signing out clears everything. The selection is in memory only: a
 * link that expired (child came of age, unlinked) silently drops out on the next load. Must sit below
 * `AuthProvider` and `ActiveClubProvider`. Child names are never logged or persisted.
 */
export function WardsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { clubs, loading: clubsLoading, error: clubsError } = useActiveClub();
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!isAuthenticated) {
      setWards([]);
      setLoading(false);
      setError(false);
      setFetched(false);
      setSelectedKey(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: unknown }>('/my-wards');
      if (id === requestId.current) {
        setWards(flattenWards(data));
        setError(false);
      }
    } catch {
      // Keep the previous list: a flaky network must not make the "Heute" entry vanish.
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setFetched(true);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<WardsContextValue>(() => {
    const selected = wards.find((w) => wardKey(w) === selectedKey) ?? wards[0] ?? null;
    const hasWards = wards.length > 0;
    return {
      wards,
      selected,
      select: setSelectedKey,
      hasWards,
      guardianOnly: isAuthenticated && hasWards && !clubsLoading && !clubsError && clubs.length === 0,
      loading: isAuthenticated && (loading || !fetched),
      error,
      reload,
    };
  }, [wards, selectedKey, isAuthenticated, clubs.length, clubsLoading, clubsError, loading, fetched, error, reload]);

  return <WardsContext.Provider value={value}>{children}</WardsContext.Provider>;
}

export function useWardsContext(): WardsContextValue {
  const ctx = useContext(WardsContext);
  if (!ctx) throw new Error('useWards must be used within a WardsProvider');
  return ctx;
}
