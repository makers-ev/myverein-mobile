import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { apiFetch } from '@/lib/api';
import { externalRoleOf, parseExternalMe, type ExternalMe, type ExternalRole } from '@/lib/outreach';
import { isOwnClub } from '@/lib/ward';

interface ExternalAccessValue {
  /** `sponsor` / `dienstleister` when the active club only knows the account as an external login, else null (normal app). */
  role: ExternalRole | null;
  /** The external self view (`GET /external/me`) of the active club; null for everybody else. */
  me: ExternalMe | null;
  /** Deciding whether the active guest membership is an external login: the start screen waits for it. */
  loading: boolean;
  /** The self view failed: the reduced screens show a retry, the role stays unknown (normal app) until it loads. */
  error: boolean;
  reload: () => Promise<void>;
}

const ExternalAccessContext = createContext<ExternalAccessValue | null>(null);

/**
 * Wave 15 M1: tells the reduced external roles from normal members. `GET /my-clubs` only says `guest`, so for a guest
 * membership (never for an own club, so members make no extra call) the app asks `GET /external/me`; its `externalOnly`
 * flag switches the navigation to the reduced app (`navigation/tabs.ts`, `ExternalStartRedirect`). The answer holds the
 * sponsor profile / assignments of the account, kept per club and only in memory; the newest request wins. Must sit
 * below `AuthProvider` and `ActiveClubProvider`.
 */
export function ExternalAccessProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { activeClub } = useActiveClub();
  const candidateId = isAuthenticated && activeClub && !isOwnClub(activeClub) ? activeClub.clubId : null;
  const [stored, setStored] = useState<{ clubId: string; me: ExternalMe } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!candidateId) return;
    setFailedFor(null);
    try {
      const res = await apiFetch<unknown>(`/external/me?clubId=${encodeURIComponent(candidateId)}`);
      const me = parseExternalMe(res);
      if (id !== requestId.current) return;
      if (me) setStored({ clubId: candidateId, me });
      else setFailedFor(candidateId);
    } catch {
      if (id === requestId.current) setFailedFor(candidateId);
    }
  }, [candidateId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<ExternalAccessValue>(() => {
    const me = candidateId && stored && stored.clubId === candidateId ? stored.me : null;
    return {
      role: externalRoleOf(me),
      me,
      // Derived synchronously, so the very first render for a guest club already waits instead of flashing the member app.
      loading: !!candidateId && !me && failedFor !== candidateId,
      error: !!candidateId && !me && failedFor === candidateId,
      reload,
    };
  }, [candidateId, stored, failedFor, reload]);

  return <ExternalAccessContext.Provider value={value}>{children}</ExternalAccessContext.Provider>;
}

const FALLBACK: ExternalAccessValue = { role: null, me: null, loading: false, error: false, reload: async () => undefined };

/** Outside the provider (isolated component tests) everybody is a normal member. */
export function useExternalAccess(): ExternalAccessValue {
  return useContext(ExternalAccessContext) ?? FALLBACK;
}
