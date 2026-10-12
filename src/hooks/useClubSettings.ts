import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

export interface ClubSettings {
  noticePeriodDays: number | null;
  noticeMode: string | null;
  memberNumberPrefix: string | null;
  /** Club switch for self-service borrowing; `inventory:write` holders are exempt (backend decides). */
  allowSelfLoans: boolean;
}

/**
 * Fetch-shaped hook for `GET /club-settings?clubId=` (readable by every member). `settings` is `null` until
 * loaded or if the request failed; callers must then fall back to the permissive default and let the backend
 * (403 on borrow) have the last word.
 */
export function useClubSettings(clubId: string | null) {
  const [loaded, setLoaded] = useState<{ clubId: string; settings: ClubSettings } | null>(null);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    apiFetch<{ data: ClubSettings }>(`/club-settings?clubId=${encodeURIComponent(clubId)}`)
      .then((res) => {
        if (!cancelled) setLoaded({ clubId, settings: res.data });
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  /** Re-reads the settings once (e.g. after a 403) and returns them, or `null` on failure. */
  const refresh = useCallback(async (): Promise<ClubSettings | null> => {
    if (!clubId) return null;
    try {
      const res = await apiFetch<{ data: ClubSettings }>(`/club-settings?clubId=${encodeURIComponent(clubId)}`);
      setLoaded({ clubId, settings: res.data });
      return res.data;
    } catch {
      return null;
    }
  }, [clubId]);

  return { refresh, settings: loaded && loaded.clubId === clubId ? loaded.settings : null };
}
