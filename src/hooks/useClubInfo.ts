import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface BoardMember {
  memberId: string;
  name: string | null;
  roleType: string;
  termEndsAt: string | null;
}

export interface Department {
  id: string;
  clubId: string;
  name: string;
  leadMemberId: string | null;
}

export interface ClubInfoPage {
  id: string;
  clubId: string;
  slug: string;
  title: string;
  contentMarkdown: string | null;
  externalUrl: string | null;
}

interface ClubInfo {
  board: BoardMember[];
  departments: Department[];
  pages: ClubInfoPage[];
}

/** Fetch-shaped hook for `GET /club-info?clubId=`, see README.md's "Adding a new API request". */
export function useClubInfo(clubId: string | null) {
  const [info, setInfo] = useState<ClubInfo | null>(null);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: ClubInfo }>(`/club-info?clubId=${clubId}`);
      setInfo(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { info, loading, refetch };
}
