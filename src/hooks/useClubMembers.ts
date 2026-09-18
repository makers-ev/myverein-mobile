import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface ClubMemberRole {
  id: string;
  roleType: string;
  departmentId: string | null;
  termEndsAt: string | null;
}

export interface ClubMember {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  orgRole: string;
  category: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  roles: ClubMemberRole[];
  // Only present when the caller has members:read_sensitive or this is
  // their own row -- see src/routes/club-members.ts's shapeMember().
  memberNumber?: string | null;
  birthDate?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

/** Fetch-shaped hook for `GET /club-members?clubId=`, see README.md's "Adding a new API request". */
export function useClubMembers(clubId: string | null) {
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: ClubMember[] }>(`/club-members?clubId=${clubId}`);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { members, loading, refetch };
}
