import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface MyChild {
  clubMemberId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
}

/**
 * Children the caller is an active guardian of (`GET /club-members/me/children?clubId=`; `[]` for everybody else). Fails
 * silently: 403/404/429/network errors all yield "no children" (the Profil tab then shows nothing extra). Race-safe: data is
 * kept with its club and only the newest request may write, so another club's children never show. Nothing is persisted.
 */
export function useMyChildren(clubId: string | null) {
  const [stored, setStored] = useState<{ clubId: string; children: MyChild[] } | null>(null);
  const [failedClub, setFailedClub] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!clubId) return;
    try {
      const res = await apiFetch<{ data: MyChild[] }>(`/club-members/me/children?clubId=${encodeURIComponent(clubId)}`);
      if (id !== seq.current) return;
      setStored({ clubId, children: Array.isArray(res.data) ? res.data : [] });
      setFailedClub(null);
    } catch {
      if (id !== seq.current) return;
      setStored(null);
      setFailedClub(clubId);
    }
  }, [clubId]);

  useEffect(() => {
    void reload();
    const current = seq;
    return () => {
      current.current++;
    };
  }, [reload]);

  const children = stored && stored.clubId === clubId ? stored.children : [];
  return { children, loading: !!clubId && !(stored && stored.clubId === clubId) && failedClub !== clubId, reload };
}

/** Name shown for a child: `displayName`, else first + last name, else an em dash. */
export const childName = (c: Pick<MyChild, 'displayName' | 'firstName' | 'lastName'>): string =>
  c.displayName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || '—';
