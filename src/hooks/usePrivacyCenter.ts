import { useCallback, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { normalizeLevels, summarizeExport, type DataRequest, type DpaCurrent, type ExportSummary, type VisibilityField, type VisibilityLevel, type VisibilityLevels } from '@/lib/privacyCenter';
import { useScopedResource } from './useScopedResource';

const clubQuery = (clubId: string | null) => (clubId ? `clubId=${encodeURIComponent(clubId)}` : '');

/**
 * Own data requests of the caller in one club (`GET /club-members/me/data-requests`) and the erasure request
 * (`POST /club-members/me/erasure-request`, `201` new or `200` the already open one: both are a success).
 * Erasure requests erase nothing by themselves, the board decides within the deadline. Nothing is logged or stored.
 */
export function useDataRequests(clubId: string | null) {
  const q = clubQuery(clubId);
  const { data, loading, error, reload } = useScopedResource<DataRequest[]>(clubId ? `/club-members/me/data-requests?${q}` : null);
  const [saving, setSaving] = useState(false);

  const requestErasure = useCallback(async (): Promise<{ ok: true } | { ok: false; error: unknown }> => {
    if (!clubId) return { ok: false, error: null };
    setSaving(true);
    try {
      await apiFetch(`/club-members/me/erasure-request?${q}`, { method: 'POST' });
      await reload();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    } finally {
      setSaving(false);
    }
  }, [clubId, q, reload]);

  return { requests: data ?? [], loading, error, reload, saving, requestErasure };
}

/**
 * Art. 15 view: loads the own data export (`GET /club-members/me/data-export`) on demand and keeps only a summary
 * (counts per area) in memory, never the content. The full copy as HTML/JSON file is a download endpoint; the app has no
 * sharing dependency, so the screen points to the website for the file.
 */
export function useDataExportSummary(clubId: string | null) {
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!clubId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: unknown }>(`/club-members/me/data-export?format=json&${clubQuery(clubId)}`);
      if (id === requestId.current) setSummary(summarizeExport(res?.data));
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId]);

  return { summary, loading, error, load };
}

/** Per-field visibility of a member (`GET|PUT /club-members/:id/visibility`); a failed switch is rolled back by the reload. */
export function useFieldVisibility(clubId: string | null, clubMemberId: string | null) {
  const path = clubId && clubMemberId ? `/club-members/${encodeURIComponent(clubMemberId)}/visibility?${clubQuery(clubId)}` : null;
  const { data, loading, error, reload, mutate } = useScopedResource<{ clubMemberId: string; levels: unknown }>(path);

  const setLevel = useCallback(
    async (field: VisibilityField, level: VisibilityLevel): Promise<{ ok: true } | { ok: false; error: unknown }> => {
      if (!path) return { ok: false, error: null };
      mutate((prev) => ({ ...prev, levels: { ...normalizeLevels(prev.levels), [field]: level } }));
      try {
        const res = await apiFetch<{ data: { clubMemberId: string; levels: unknown } }>(path, { method: 'PUT', body: { [field]: level } });
        if (res?.data) mutate(() => res.data);
        return { ok: true };
      } catch (err) {
        void reload();
        return { ok: false, error: err };
      }
    },
    [path, mutate, reload],
  );

  const levels: VisibilityLevels | null = data ? normalizeLevels(data.levels) : null;
  return { levels, loading, error, reload, setLevel };
}

/** `GET /dpa/current`: only the owner-hint and the lock state are used; the contract itself is read and confirmed on the website. */
export function useDpaStatus(clubId: string | null) {
  const { data, loading, error, reload } = useScopedResource<DpaCurrent>(clubId ? `/dpa/current?${clubQuery(clubId)}` : null);
  return { dpa: data, loading, error, reload };
}

export interface ClubPrivacyNotice {
  id: string;
  version: number;
  body: string;
  sha256: string;
  publishedAt: string;
}

/** `GET /club-privacy-notices/current` (any member): the club's Datenschutzhinweis, `null` while none is published. */
export function useClubPrivacyNotice(clubId: string | null) {
  const { data, loading, error, reload } = useScopedResource<ClubPrivacyNotice | null>(clubId ? `/club-privacy-notices/current?${clubQuery(clubId)}` : null);
  return { notice: data ?? null, loading, error, reload };
}
