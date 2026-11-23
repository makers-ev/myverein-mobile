import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';
import { parseSponsors, type Sponsor } from '@/lib/outreach';

/**
 * Sponsors and partners of the club (`GET /sponsors?clubId=`), read only (Wave 15 M1). Only requested for a board role
 * (`enabled`); a 403 means the viewer has no right and stays an error state (deny by default). Kept together with its club,
 * only the newest request writes, a failed reload keeps the old rows. Contacts are business contacts: never logged or cached.
 */
export function useSponsors(clubId: string | null, enabled: boolean) {
  const { isAuthenticated } = useAuth();
  const active = isAuthenticated && enabled && !!clubId;
  const [stored, setStored] = useState<{ clubId: string; list: Sponsor[] } | null>(null);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!active || !clubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<unknown>(`/sponsors?clubId=${encodeURIComponent(clubId)}`);
      const list = parseSponsors(res);
      if (id !== requestId.current) return;
      if (!list) throw new Error('Malformed sponsors answer');
      setStored({ clubId, list });
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [active, clubId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sponsors = stored && stored.clubId === clubId ? stored.list : null;
  return { sponsors, loading, error, reload };
}
