import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  type CredentialOverviewField,
  type CredentialOverviewResponse,
  normalizeOverviewQuery,
  type OverviewQuery,
  overviewPath,
} from '@/lib/credentials';

export type OverviewFailure = 'notFound' | 'generic';

/**
 * Board / Funktionstraeger overview of profile-module credentials (`GET /club-members/credentials`): one page for the
 * current club + filters. Race-safe: every load takes a sequence number and only the newest may write state; results and
 * failures are stored together with their club + query key, so a late answer for another club or filter is dropped and values
 * of one club never show in another. `hidden` = the caller may not use the overview in this club (403, or 404 without a field
 * filter): the UI renders nothing. A 404 *with* a field filter means that field is gone or not visible (`failure =
 * 'notFound'`). Nothing is cached or persisted -- credential values only live in this hook's state.
 */
export function useCredentialOverview(clubId: string | null, query: OverviewQuery) {
  const q = normalizeOverviewQuery(query);
  const path = clubId ? overviewPath(clubId, q) : null;
  const key = clubId && path ? `${clubId}|${path}` : null;
  const filtered = q.fieldKey !== null;

  const [stored, setStored] = useState<{ key: string; response: CredentialOverviewResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; kind: OverviewFailure } | null>(null);
  const [known, setKnown] = useState<{ clubId: string; fields: CredentialOverviewField[] } | null>(null);
  const [hiddenClub, setHiddenClub] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!path || !key || !clubId) return;
    setFailure((cur) => (cur && cur.key !== key ? null : cur));
    try {
      const response = await apiFetch<CredentialOverviewResponse>(path);
      if (id !== seq.current) return;
      setStored({ key, response });
      setKnown({ clubId, fields: response.fields });
      setFailure(null);
    } catch (err) {
      if (id !== seq.current) return;
      if (err instanceof ApiError && (err.status === 403 || (err.status === 404 && !filtered))) {
        setHiddenClub(clubId);
        setStored(null);
        return;
      }
      setFailure({ key, kind: err instanceof ApiError && err.status === 404 ? 'notFound' : 'generic' });
    }
  }, [path, key, clubId, filtered]);

  useEffect(() => {
    void reload();
    const current = seq;
    return () => {
      // Drops the pending load of the previous club/filter on change and on unmount.
      current.current++;
    };
  }, [reload]);

  const response = stored && stored.key === key ? stored.response : null;
  const failed = failure && failure.key === key ? failure.kind : null;
  return {
    response,
    fields: known && known.clubId === clubId ? known.fields : null,
    hidden: hiddenClub !== null && hiddenClub === clubId,
    failure: response ? null : failed,
    loading: !!key && !response && !failed,
    reload,
  };
}
