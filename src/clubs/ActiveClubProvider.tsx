import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import { clearStoredActiveClubId, getStoredActiveClubId, setStoredActiveClubId } from './activeClubStorage';

export interface MyClub {
  clubId: string;
  memberId: string;
  clubName: string | null;
  orgRole: string;
}

interface ActiveClubContextValue {
  clubs: MyClub[];
  /** The selected club, falling back to the first membership; null without any membership. */
  activeClub: MyClub | null;
  loading: boolean;
  refetch: () => Promise<void>;
  setActiveClubId: (clubId: string) => void;
}

const ActiveClubContext = createContext<ActiveClubContextValue | null>(null);

/**
 * Single source of truth for `GET /my-clubs` and the selected club. The
 * choice is persisted (`activeClubStorage.ts`); if the stored club is no
 * longer one of the user's memberships, `activeClub` falls back to the first
 * one. Must sit below `AuthProvider`.
 */
export function ActiveClubProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [clubs, setClubs] = useState<MyClub[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionLoaded, setSelectionLoaded] = useState(false);

  // Only the newest fetch may write state (sign-out or a refetch bumps this).
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getStoredActiveClubId()
      .then((id) => {
        if (!cancelled) setSelectedId(id);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSelectionLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!isAuthenticated) {
      setClubs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: MyClub[] }>('/my-clubs');
      if (id === requestId.current) setClubs(data);
    } catch {
      // Keep the previous list; consumers show their own empty/error state.
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // A different account on the same device must not inherit the old choice.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      setSelectedId(null);
      void clearStoredActiveClubId().catch(() => undefined);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  const setActiveClubId = useCallback((clubId: string) => {
    setSelectedId(clubId);
    void setStoredActiveClubId(clubId).catch(() => undefined);
  }, []);

  const value = useMemo<ActiveClubContextValue>(() => {
    const activeClub = clubs.find((c) => c.clubId === selectedId) ?? clubs[0] ?? null;
    return {
      clubs,
      activeClub,
      // Wait for the stored choice too, so the first club never flashes before the saved one.
      loading: loading || (isAuthenticated && !selectionLoaded),
      refetch,
      setActiveClubId,
    };
  }, [clubs, selectedId, loading, isAuthenticated, selectionLoaded, refetch, setActiveClubId]);

  return <ActiveClubContext.Provider value={value}>{children}</ActiveClubContext.Provider>;
}

export function useActiveClub(): ActiveClubContextValue {
  const ctx = useContext(ActiveClubContext);
  if (!ctx) throw new Error('useActiveClub must be used inside ActiveClubProvider');
  return ctx;
}
