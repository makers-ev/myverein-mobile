import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface AvailabilitySlot {
  id: string;
  memberId: string;
  weekday: number; // 0=Montag..6=Sonntag
  startTime: string; // "HH:MM:SS"
  endTime: string; // "HH:MM:SS"
  note: string | null;
}

export interface AvailabilityException {
  id: string;
  memberId: string;
  date: string; // "YYYY-MM-DD"
  isAvailable: boolean;
  note: string | null;
}

/**
 * Self-service availability data (`/availability/slots`, `/availability/exceptions`),
 * clubGuard-scoped to the caller's own membership -- same fetch/loading shape as
 * useOwnMembership.ts, plus mutation helpers so VerfuegbarkeitTab doesn't touch apiFetch directly.
 */
export function useAvailability(clubId: string | null) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setSlots([]);
      setExceptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [slotsRes, exceptionsRes] = await Promise.all([
        apiFetch<{ data: AvailabilitySlot[] }>(`/availability/slots?clubId=${clubId}`),
        apiFetch<{ data: AvailabilityException[] }>(`/availability/exceptions?clubId=${clubId}`),
      ]);
      setSlots(slotsRes.data);
      setExceptions(exceptionsRes.data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // At most one slot per weekday in this UI -- the API allows more, but a single
  // toggle+range per day is the guided UX this screen needs (see VerfuegbarkeitTab.tsx).
  const upsertSlot = useCallback(
    async (weekday: number, startTime: string, endTime: string) => {
      const existing = slots.find((s) => s.weekday === weekday);
      if (existing) {
        const { data } = await apiFetch<{ data: AvailabilitySlot }>(`/availability/slots/${existing.id}?clubId=${clubId}`, {
          method: 'PATCH',
          body: { startTime, endTime },
        });
        setSlots((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      } else {
        const { data } = await apiFetch<{ data: AvailabilitySlot }>(`/availability/slots?clubId=${clubId}`, {
          method: 'POST',
          body: { weekday, startTime, endTime },
        });
        setSlots((prev) => [...prev, data]);
      }
    },
    [clubId, slots],
  );

  const deleteSlotForWeekday = useCallback(
    async (weekday: number) => {
      const existing = slots.find((s) => s.weekday === weekday);
      if (!existing) return;
      await apiFetch(`/availability/slots/${existing.id}?clubId=${clubId}`, { method: 'DELETE' });
      setSlots((prev) => prev.filter((s) => s.id !== existing.id));
    },
    [clubId, slots],
  );

  const createException = useCallback(
    async (date: string, isAvailable: boolean, note?: string) => {
      const { data } = await apiFetch<{ data: AvailabilityException }>(`/availability/exceptions?clubId=${clubId}`, {
        method: 'POST',
        body: { date, isAvailable, ...(note?.trim() ? { note: note.trim() } : {}) },
      });
      setExceptions((prev) => [data, ...prev]);
    },
    [clubId],
  );

  const deleteException = useCallback(
    async (id: string) => {
      await apiFetch(`/availability/exceptions/${id}?clubId=${clubId}`, { method: 'DELETE' });
      setExceptions((prev) => prev.filter((e) => e.id !== id));
    },
    [clubId],
  );

  return { slots, exceptions, loading, refetch, upsertSlot, deleteSlotForWeekday, createException, deleteException };
}
