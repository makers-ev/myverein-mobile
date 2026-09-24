import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { ClubMember } from './useClubMembers';

/** Fetch-shaped hook for `GET /club-members/me?clubId=`, always includes sensitive fields (it's the caller's own row). */
export function useOwnMembership(clubId: string | null) {
  const [membership, setMembership] = useState<ClubMember | null>(null);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setMembership(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: ClubMember }>(`/club-members/me?clubId=${clubId}`);
      setMembership(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const can = useCallback((permission: string) => !!membership?.permissions?.includes(permission), [membership]);

  return { membership, loading, refetch, can };
}
