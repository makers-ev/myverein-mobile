import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

// Re-exported here (not just from `@/lib/mediaKey`) so `MaterialTab.tsx`
// can pull every inventory-domain type/helper from this one hook module --
// the function itself lives in a dependency-free file so it stays
// unit-testable without pulling in `apiFetch`'s `authClient` import chain.
export { damageReportPhotoKey } from '@/lib/mediaKey';

export interface InventoryItem {
  id: string;
  clubId: string;
  name: string;
  category: string | null;
  condition: string;
  locationId: string | null;
  acquisitionValueCents: number | null;
  acquiredAt: string | null;
  maintenanceIntervalDays: number | null;
  lastMaintenanceAt: string | null;
  /** Server-derived, never stored -- see myverein-backend's lib/inventory-status.ts. */
  maintenanceDue: boolean;
  /** Server-derived, never stored. */
  maintenanceDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLoan {
  id: string;
  itemId: string;
  memberId: string;
  borrowedAt: string;
  dueAt: string | null;
  returnedAt: string | null;
  /** Already has the live "ueberfaellig" override baked in server-side -- just display it, don't re-derive it. */
  status: string;
}

export interface DamageReport {
  id: string;
  itemId: string;
  reportedBy: string;
  description: string;
  /**
   * A media *path* (`/media/<key>`), not a key and not a display URL -- the
   * backend's `withPhotoUrl` prepends `/media/` to the stored key. `null`
   * when no photo was attached. Use `damageReportPhotoKey()` below to get
   * back the bare key `downloadMediaUri` needs.
   */
  photoUrl: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

/** Fetch-shaped hook for `GET /inventory-items?clubId=`, see README.md's "Adding a new API request". */
export function useInventoryItems(clubId: string | null) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: InventoryItem[] }>(`/inventory-items?clubId=${clubId}`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { items, loading, refetch };
}

/**
 * Fetch-shaped hook for a single inventory item's detail view: the item
 * itself, its loans, and its damage reports, all fetched in parallel via
 * `Promise.all` and re-fetchable together via `refetch`.
 */
export function useInventoryItemDetail(clubId: string | null, itemId: string | null) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loans, setLoans] = useState<InventoryLoan[]>([]);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(!!(clubId && itemId));

  const refetch = useCallback(async () => {
    if (!clubId || !itemId) {
      setItem(null);
      setLoans([]);
      setDamageReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [itemRes, loansRes, damageReportsRes] = await Promise.all([
        apiFetch<{ data: InventoryItem }>(`/inventory-items/${itemId}?clubId=${clubId}`),
        apiFetch<{ data: InventoryLoan[] }>(`/inventory-items/${itemId}/loans?clubId=${clubId}`),
        apiFetch<{ data: DamageReport[] }>(`/inventory-items/${itemId}/damage-reports?clubId=${clubId}`),
      ]);
      setItem(itemRes.data);
      setLoans(loansRes.data);
      setDamageReports(damageReportsRes.data);
    } finally {
      setLoading(false);
    }
  }, [clubId, itemId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { item, loans, damageReports, loading, refetch };
}

/**
 * Self-service borrow/return + damage-report actions for one inventory
 * item -- kept separate so callers that only need these don't pull in the
 * detail fetch. Same pattern as `useEventRsvp` in `useEvents.ts`.
 */
export function useInventoryActions(clubId: string | null, itemId: string | null, onChanged?: () => void) {
  const borrow = useCallback(
    async (dueAt?: string) => {
      const { data } = await apiFetch<{ data: InventoryLoan }>(`/inventory-items/${itemId}/loans?clubId=${clubId}`, {
        method: 'POST',
        body: { dueAt },
      });
      onChanged?.();
      return data;
    },
    [clubId, itemId, onChanged],
  );

  const returnLoan = useCallback(
    async (loanId: string) => {
      const { data } = await apiFetch<{ data: InventoryLoan }>(`/inventory-items/${itemId}/loans/${loanId}?clubId=${clubId}`, {
        method: 'PATCH',
      });
      onChanged?.();
      return data;
    },
    [clubId, itemId, onChanged],
  );

  const reportDamage = useCallback(
    async (description: string, photoKey?: string) => {
      const { data } = await apiFetch<{ data: DamageReport }>(`/inventory-items/${itemId}/damage-reports?clubId=${clubId}`, {
        method: 'POST',
        body: { description, photoKey },
      });
      onChanged?.();
      return data;
    },
    [clubId, itemId, onChanged],
  );

  return { borrow, returnLoan, reportDamage };
}

/** Body for POST/PATCH `/inventory-items`; `null` clears a field on PATCH, create omits empty fields. */
export interface InventoryItemInput {
  name: string;
  category?: string | null;
  condition: string;
  locationId?: string | null;
  acquisitionValueCents?: number | null;
  acquiredAt?: string | null;
  maintenanceIntervalDays?: number | null;
  lastMaintenanceAt?: string | null;
}

export type DamageReportStatus = 'gemeldet' | 'in_bearbeitung' | 'behoben';

/** Mutation-shaped hook for `inventory:write` actions (item CRUD, damage-report triage). */
export function useInventoryMutations(clubId: string | null) {
  const createItem = useCallback(
    (input: InventoryItemInput) =>
      apiFetch<{ data: InventoryItem }>(`/inventory-items?clubId=${clubId}`, { method: 'POST', body: input }),
    [clubId],
  );

  const updateItem = useCallback(
    (itemId: string, input: InventoryItemInput) =>
      apiFetch<{ data: InventoryItem }>(`/inventory-items/${itemId}?clubId=${clubId}`, { method: 'PATCH', body: input }),
    [clubId],
  );

  const deleteItem = useCallback(
    (itemId: string) => apiFetch<void>(`/inventory-items/${itemId}?clubId=${clubId}`, { method: 'DELETE' }),
    [clubId],
  );

  const setDamageReportStatus = useCallback(
    (itemId: string, reportId: string, status: DamageReportStatus) =>
      apiFetch<{ data: DamageReport }>(`/inventory-items/${itemId}/damage-reports/${reportId}?clubId=${clubId}`, {
        method: 'PATCH',
        body: { status },
      }),
    [clubId],
  );

  return { createItem, updateItem, deleteItem, setDamageReportStatus };
}
