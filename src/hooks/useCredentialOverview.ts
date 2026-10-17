import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  type CredentialOverviewField,
  type CredentialOverviewResponse,
  DEFAULT_OVERVIEW_QUERY,
  normalizeOverviewQuery,
  type OverviewQuery,
  overviewPath,
} from '@/lib/credentials';

export type OverviewFailure = 'notFound' | 'rateLimit' | 'generic';

/**
 * Board / Funktionstraeger overview of profile-module credentials (`GET /club-members/credentials`): one page for the
 * current club + filters. Race-safe: every load takes a sequence number and only the newest may write state; results and
 * failures are stored together with their club + query key, so a late answer for another club or filter is dropped and values
 * of one club never show in another. `hidden` = the caller may not use the overview in this club (403, or 404 without a field
 * filter): the UI renders nothing. A 404 *with* a field filter means that field is gone or not visible (`failure =
 * 'notFound'`). Nothing is cached or persisted -- credential values only live in this hook's state.
 */
export function useCredentialOverview(clubId: string | null, query: OverviewQuery, enabled = true) {
  const q = normalizeOverviewQuery(query);
  // Collapsed: only a one-row probe (page size 1, default query) decides whether the card exists at all; the full page is
  // loaded once `enabled` (first expand) and again on every filter/page change.
  const path = clubId ? (enabled ? overviewPath(clubId, q) : overviewPath(clubId, DEFAULT_OVERVIEW_QUERY, 1)) : null;
  const key = clubId && path ? `${clubId}|${path}` : null;
  const filtered = enabled && q.fieldKey !== null;

  const [stored, setStored] = useState<{ key: string; response: CredentialOverviewResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; kind: OverviewFailure } | null>(null);
  const [known, setKnown] = useState<{ clubId: string; fields: CredentialOverviewField[] } | null>(null);
  const [hiddenClub, setHiddenClub] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const knownRef = useRef<{ clubId: string; fields: CredentialOverviewField[] } | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!path || !key || !clubId) return;
    // The probe ran already (fields known for this club): collapsing/re-mounting does not probe again.
    if (!enabled && knownRef.current?.clubId === clubId) return;
    setFailure((cur) => (cur && cur.key !== key ? null : cur));
    try {
      const response = await apiFetch<CredentialOverviewResponse>(path);
      if (id !== seq.current) return;
      setStored({ key, response });
      knownRef.current = { clubId, fields: response.fields };
      setKnown(knownRef.current);
      setFailure(null);
    } catch (err) {
      if (id !== seq.current) return;
      if (err instanceof ApiError && (err.status === 403 || (err.status === 404 && !filtered))) {
        setHiddenClub(clubId);
        setStored(null);
        return;
      }
      const kind: OverviewFailure = err instanceof ApiError && err.status === 404 ? 'notFound' : err instanceof ApiError && err.status === 429 ? 'rateLimit' : 'generic';
      setFailure({ key, kind });
    }
  }, [path, key, clubId, filtered, enabled, nonce]);

  /** Forget a "hidden" verdict and probe again (a role change can make the card visible without a club switch). */
  const recheck = useCallback(() => {
    setHiddenClub(null);
    knownRef.current = null;
    setKnown(null);
    setNonce((n) => n + 1);
  }, []);

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
    recheck,
  };
}
