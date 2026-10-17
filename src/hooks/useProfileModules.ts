import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';
import type { ContentLang } from '@/lib/customFields';
import { type CatalogResponse, catalogPath, modulePath } from '@/lib/profileModules';

export type CatalogData = CatalogResponse['data'];
export type CatalogFailure = 'forbidden' | 'rateLimit' | 'generic';

/**
 * Profile module catalog of one club for the board (`GET /member-fields/catalog?clubId&lang`, `forms:write`) plus the one-click
 * switches (`POST .../activate|deactivate`). Race-safe: data and failures are stored together with club + language, every load
 * takes a sequence number and only the newest may write state, so a late answer for another club/language is dropped and the
 * catalog of one club never shows in another. A switch reloads the catalog afterwards (state, limit) and rejects with the
 * `ApiError` so the caller can map it. Nothing is cached or persisted.
 */
export function useProfileModules(clubId: string | null, lang: ContentLang) {
  const key = clubId ? `${clubId}|${lang}` : null;
  const [stored, setStored] = useState<{ key: string; data: CatalogData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; kind: CatalogFailure } | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!clubId || !key) return;
    setFailure((cur) => (cur && cur.key !== key ? null : cur));
    try {
      const res = await apiFetch<CatalogResponse>(catalogPath(clubId, lang));
      if (id !== seq.current) return;
      setStored({ key, data: res.data });
      setFailure(null);
    } catch (err) {
      if (id !== seq.current) return;
      const kind: CatalogFailure = err instanceof ApiError && err.status === 403 ? 'forbidden' : err instanceof ApiError && err.status === 429 ? 'rateLimit' : 'generic';
      setFailure({ key, kind });
    }
  }, [clubId, lang, key]);

  useEffect(() => {
    void reload();
    const current = seq;
    return () => {
      current.current++;
    };
  }, [reload]);

  const toggle = useCallback(
    async (moduleId: string, action: 'activate' | 'deactivate'): Promise<void> => {
      if (!clubId) throw new Error('no club');
      await apiFetch(modulePath(clubId, moduleId, action, lang), { method: 'POST', body: {} });
      await reload();
    },
    [clubId, lang, reload],
  );

  const data = stored && stored.key === key ? stored.data : null;
  const failed = failure && failure.key === key ? failure.kind : null;
  return { data, failure: data ? null : failed, loadFailedAfterData: data ? failed : null, loading: !!key && !data && !failed, reload, toggle };
}
