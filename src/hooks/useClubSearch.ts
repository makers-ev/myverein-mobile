import { useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { canSearchClubs, normalizeSearchQuery, parseClubHits, type ClubSearchHit } from '@/lib/outreach';

export type ClubSearchPhase = 'idle' | 'loading' | 'done' | 'error';

const DEBOUNCE_MS = 400;

/**
 * "Verein finden" (Wave 15 M2): `GET /public/clubs?q=` over clubs that opted in to being found. Starts from
 * `MIN_CLUB_SEARCH_LENGTH` characters, debounced, only the newest request may write. There is deliberately no city
 * filter UI and no "did you mean": a miss looks the same for a club that does not exist and one that is not listed
 * (no enumeration hint). The query is never logged or stored.
 */
export function useClubSearch(query: string) {
  const [state, setState] = useState<{ q: string; phase: ClubSearchPhase; hits: ClubSearchHit[]; error: unknown }>({ q: '', phase: 'idle', hits: [], error: null });
  const [retry, setRetry] = useState(0);
  const requestId = useRef(0);
  const q = normalizeSearchQuery(query);
  const searchable = canSearchClubs(q);

  useEffect(() => {
    const id = ++requestId.current;
    if (!searchable) return undefined;
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, q, phase: 'loading', error: null }));
      apiFetch<unknown>(`/public/clubs?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (id !== requestId.current) return;
          const hits = parseClubHits(res);
          setState(hits ? { q, phase: 'done', hits, error: null } : { q, phase: 'error', hits: [], error: new Error('Malformed answer') });
        })
        .catch((err: unknown) => {
          if (id === requestId.current) setState({ q, phase: 'error', hits: [], error: err });
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, searchable, retry]);

  // Typing below the minimum (or clearing) resets at once; results of an older query are never shown for a newer one.
  if (!searchable) return { phase: 'idle' as ClubSearchPhase, hits: [] as ClubSearchHit[], error: null, retry: () => setRetry((n) => n + 1) };
  const fresh = state.q === q;
  return {
    phase: (fresh ? state.phase : 'loading') as ClubSearchPhase,
    hits: fresh ? state.hits : [],
    error: fresh ? state.error : null,
    retry: () => setRetry((n) => n + 1),
  };
}
