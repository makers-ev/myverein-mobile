import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface ClubApplication {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  category: string | null;
  birthDate: string | null;
  status: string;
  createdAt: string;
}

/**
 * Fetch-shaped hook for `GET /club-applications?clubId=` (open applications
 * only, needs `members:write`), plus the approve/reject mutations
 * (`POST /club-applications/:id/{approve,reject}?clubId=`).
 */
export function useClubApplications(clubId: string | null) {
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [loading, setLoading] = useState(!!clubId);
  const [error, setError] = useState(false);

  // Only the newest request may write state: a decision or a clubId change
  // bumps this so an older in-flight fetch can't resurrect stale data.
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) {
      setApplications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data } = await apiFetch<{ data: ClubApplication[] }>(`/club-applications?clubId=${clubId}`);
      if (id === requestId.current) setApplications(data);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const decide = useCallback(
    async (id: string, action: 'approve' | 'reject') => {
      if (!clubId) return;
      await apiFetch(`/club-applications/${id}/${action}?clubId=${clubId}`, { method: 'POST' });
      // The decided application is no longer open -- drop it locally and
      // invalidate any in-flight fetch that still contains it.
      requestId.current++;
      setLoading(false);
      setApplications((prev) => prev.filter((a) => a.id !== id));
    },
    [clubId],
  );

  const approve = useCallback((id: string) => decide(id, 'approve'), [decide]);
  const reject = useCallback((id: string) => decide(id, 'reject'), [decide]);

  return { applications, loading, error, refetch, approve, reject };
}
