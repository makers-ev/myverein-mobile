import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { parsePublicClub, type PublicClubInfo } from '@/lib/outreach';

/**
 * The club's public page (`GET /public/clubs/:slug`, Wave 15 M1) for the sponsor view: only what the club released
 * (no member data). `404` is not an error: the club simply has no public page, `info` stays null and `missing` is true.
 * Only the newest request writes; a failed reload keeps the last answer.
 */
export function usePublicClub(slug: string | null) {
  const [stored, setStored] = useState<{ slug: string; info: PublicClubInfo | null } | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<unknown>(`/public/clubs/${encodeURIComponent(slug)}`);
      const info = parsePublicClub(res);
      if (id !== requestId.current) return;
      if (!info) throw new Error('Malformed public club answer');
      setStored({ slug, info });
    } catch (err) {
      if (id !== requestId.current) return;
      if (err instanceof ApiError && err.status === 404) setStored({ slug, info: null });
      else setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mine = stored && stored.slug === slug ? stored : null;
  return { info: mine?.info ?? null, missing: mine !== null && mine.info === null, loading, error, reload };
}
