import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useWards } from '@/hooks/useWards';
import { apiFetch } from '@/lib/api';
import { externalRoleOf, externalRolesOf, parseExternalMe, type ExternalMe, type ExternalRole } from '@/lib/outreach';
import { isOwnClub } from '@/lib/ward';

interface ExternalAccessValue {
  /** Primary reduced role (`sponsor` wins) when the active club only knows the account as an external login, else null. */
  role: ExternalRole | null;
  /** All reduced roles of the account in the active club (an account may hold both). */
  roles: ExternalRole[];
  /** The external self view (`GET /external/me`) of the active club; null for everybody else. */
  me: ExternalMe | null;
  /** The role of the active guest membership is not known yet. */
  loading: boolean;
  /** The self view failed (offline, suspended club, server error); the last failure, null otherwise. */
  error: unknown;
  /**
   * Fail closed: show the reduced app (Heute/Mehr) -- true for a resolved external role AND for a guest membership whose
   * role is not known (loading or failed), unless the account has wards (a guardian's guest membership is expected).
   * Never a full member app on a guess.
   */
  reduced: boolean;
  reload: () => Promise<void>;
}

const ExternalAccessContext = createContext<ExternalAccessValue | null>(null);

/** While the role is unknown after a failure the provider asks again this often (and on every app resume). */
const RETRY_MS = 20_000;

/**
 * Wave 15 M1: tells the reduced external logins from normal members. `GET /my-clubs` only says `guest`, so for a guest
 * membership of the active club (never for an own club, so members make no extra call) the app asks `GET /external/me`; its
 * `externalOnly` flag switches the navigation to the reduced app (`navigation/tabs.ts`, `ExternalStartRedirect`).
 * Fail closed: without an answer (loading, offline, `CLUB_SUSPENDED`) the account sees the reduced app with a retry, never the
 * member app. It reloads on app resume, on every club change and every 20 s while the role is unknown after a failure; a role
 * change on the server therefore shows up the next time the app comes to the front. The answer (sponsor entries without
 * internal notes, assignments) is kept in memory only, per club, newest request wins. Must sit below `AuthProvider`,
 * `ActiveClubProvider` and `WardsProvider`.
 */
export function ExternalAccessProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { activeClub } = useActiveClub();
  const { hasWards } = useWards();
  const candidateId = isAuthenticated && activeClub && !isOwnClub(activeClub) ? activeClub.clubId : null;
  const [stored, setStored] = useState<{ clubId: string; me: ExternalMe } | null>(null);
  const [failure, setFailure] = useState<{ clubId: string; error: unknown } | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!candidateId) return;
    try {
      const res = await apiFetch<unknown>(`/external/me?clubId=${encodeURIComponent(candidateId)}`);
      const me = parseExternalMe(res);
      if (id !== requestId.current) return;
      if (me) {
        setStored({ clubId: candidateId, me });
        setFailure(null);
      } else {
        setFailure({ clubId: candidateId, error: new Error('Malformed external answer') });
      }
    } catch (err) {
      if (id === requestId.current) setFailure({ clubId: candidateId, error: err });
    }
  }, [candidateId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Resume: the role may have changed while the app was in the background.
  useEffect(() => {
    if (!candidateId) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [candidateId, reload]);

  const failed = !!candidateId && failure?.clubId === candidateId;
  const me = candidateId && stored && stored.clubId === candidateId ? stored.me : null;

  // No answer yet because of a failure: try again, the account must not stay in the dark until it restarts the app.
  const unknownAfterFailure = failed && !me;
  useEffect(() => {
    if (!unknownAfterFailure) return undefined;
    const id = setInterval(() => void reload(), RETRY_MS);
    return () => clearInterval(id);
  }, [unknownAfterFailure, reload]);

  const value = useMemo<ExternalAccessValue>(() => {
    const roles = externalRolesOf(me);
    const unknown = !!candidateId && !me;
    return {
      role: externalRoleOf(me),
      roles,
      me,
      // Derived synchronously, so the very first render for a guest club already waits instead of flashing the member app.
      loading: unknown && !failed,
      error: failed && !me ? failure?.error : null,
      reduced: roles.length > 0 || (unknown && !hasWards),
      reload,
    };
  }, [candidateId, me, failed, failure, hasWards, reload]);

  return <ExternalAccessContext.Provider value={value}>{children}</ExternalAccessContext.Provider>;
}

const FALLBACK: ExternalAccessValue = { role: null, roles: [], me: null, loading: false, error: null, reduced: false, reload: async () => undefined };

/** Outside the provider (isolated component tests) everybody is a normal member. */
export function useExternalAccess(): ExternalAccessValue {
  return useContext(ExternalAccessContext) ?? FALLBACK;
}
