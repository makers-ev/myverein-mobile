import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface Calendar {
  id: string;
  clubId: string;
  departmentId: string | null;
  name: string;
  isDefault: boolean;
  icalImportUrl: string | null;
  createdBy: string;
  createdAt: string;
}

/** Fetch-shaped hook for `GET /calendars?clubId=`, see README.md's "Adding a new API request". */
export function useCalendars(clubId: string | null) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setCalendars([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: Calendar[] }>(`/calendars?clubId=${clubId}`);
      setCalendars(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { calendars, loading, refetch };
}
