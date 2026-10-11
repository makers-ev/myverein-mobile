import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface ClubStats {
  members: { total: number; active: number; withAccount: number; withoutAccount: number };
  byStatus: Record<string, number>;
  byCategory: { key: string; name: string; count: number }[];
}

/**
 * Fetch-shaped hook for `GET /club-stats?clubId=` (counts only; board roles,
 * surfaced as `club_stats:read`). Pass `enabled=false` for everybody else so
 * no request (and no 403) is made.
 */
export function useClubStats(clubId: string | null, enabled: boolean) {
  const [stored, setStored] = useState<{ clubId: string; stats: ClubStats } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data } = await apiFetch<{ data: ClubStats }>(`/club-stats?clubId=${encodeURIComponent(clubId)}`);
      if (id === requestId.current) setStored({ clubId, stats: data });
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const stats = enabled && stored && stored.clubId === clubId ? stored.stats : null;
  return { stats, loading, error, refetch };
}
