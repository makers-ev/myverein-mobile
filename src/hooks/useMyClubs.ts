import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';

export interface MyClub {
  clubId: string;
  memberId: string;
  clubName: string | null;
  orgRole: string;
}

/**
 * Fetch-shaped hook (see README.md's "Adding a new API request") for
 * `GET /my-clubs`. Wave 1 UI assumes a member belongs to exactly one club
 * (realistic default usage, even though the data model supports more) --
 * `activeClub` is simply the first row. A multi-club switcher is a
 * documented gap for a later wave, not something this hook tries to solve.
 */
export function useMyClubs() {
  const { isAuthenticated } = useAuth();
  const [clubs, setClubs] = useState<MyClub[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setClubs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: MyClub[] }>('/my-clubs');
      setClubs(data);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { clubs, activeClub: clubs[0] ?? null, loading, refetch };
}
