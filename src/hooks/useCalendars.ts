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

export interface CalendarVisibility {
  id: string;
  calendarId: string;
  memberId: string | null;
  roleType: string | null;
  departmentId: string | null;
}

export type VisibilityGrant = { roleType: string } | { departmentId: string };

/** Board-side calendar management (`calendars:write`), `onChanged` refetches the calendar list. */
export function useCalendarAdmin(clubId: string | null, onChanged?: () => void) {
  const createCalendar = useCallback(
    async (name: string, departmentId: string | null) => {
      await apiFetch(`/calendars?clubId=${clubId}`, { method: 'POST', body: { name, ...(departmentId ? { departmentId } : {}) } });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  const updateCalendar = useCallback(
    async (id: string, changes: { name?: string; departmentId?: string | null }) => {
      await apiFetch(`/calendars/${id}?clubId=${clubId}`, { method: 'PATCH', body: changes });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  const deleteCalendar = useCallback(
    async (id: string) => {
      await apiFetch(`/calendars/${id}?clubId=${clubId}`, { method: 'DELETE' });
      onChanged?.();
    },
    [clubId, onChanged],
  );

  const listVisibility = useCallback(
    async (id: string) => (await apiFetch<{ data: CalendarVisibility[] }>(`/calendars/${id}/visibility?clubId=${clubId}`)).data,
    [clubId],
  );

  const addVisibility = useCallback(
    async (id: string, grant: VisibilityGrant) =>
      (await apiFetch<{ data: CalendarVisibility }>(`/calendars/${id}/visibility?clubId=${clubId}`, { method: 'POST', body: grant })).data,
    [clubId],
  );

  const removeVisibility = useCallback(
    async (id: string, visibilityId: string) => {
      await apiFetch(`/calendars/${id}/visibility/${visibilityId}?clubId=${clubId}`, { method: 'DELETE' });
    },
    [clubId],
  );

  return { createCalendar, updateCalendar, deleteCalendar, listVisibility, addVisibility, removeVisibility };
}
