import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { ClubMember } from './useClubMembers';

export type ClubPermission =
  | 'members:write'
  | 'members:read_sensitive'
  | 'roles:write'
  | 'departments:write'
  | 'club_info:write'
  | 'calendars:write'
  | 'meetings:write'
  | 'locations:write'
  | 'inventory:write';

/** Fetch-shaped hook for `GET /club-members/me?clubId=`, always includes sensitive fields (it's the caller's own row). */
export function useOwnMembership(clubId: string | null) {
  const [membership, setMembership] = useState<ClubMember | null>(null);
  const [loading, setLoading] = useState(!!clubId);

  // Only the newest request may write state, and the previous club's
  // membership (and thus its permissions) is dropped as soon as clubId changes.
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: ClubMember }>(`/club-members/me?clubId=${clubId}`);
      if (id === requestId.current) setMembership(data);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    setMembership(null);
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const can = useCallback((permission: ClubPermission) => !!membership?.permissions?.includes(permission), [membership]);

  return { membership, loading, refetch, can };
}
