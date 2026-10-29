import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { apiFetch } from '@/lib/api';
import { parseSearch, parseToday, SEARCH_MIN_CHARS, type SearchResults, type Today } from '@/lib/today';

/**
 * `GET /clubs/:clubId/today` (Wave 14 N2). Reloads when the app returns to the foreground so "Heute" never shows
 * yesterday's list. Keeps the last answer on a failed reload (`error` is set, `today` stays) so a flaky connection does
 * not blank the screen. Pass `null` for a guest or a person without a club: no request is made.
 */
export function useToday(clubId: string | null) {
  const [stored, setStored] = useState<{ clubId: string; today: Today } | null>(null);
  const [loading, setLoading] = useState(!!clubId);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await apiFetch<unknown>(`/clubs/${encodeURIComponent(clubId)}/today`);
      if (id === requestId.current) setStored({ clubId, today: parseToday(raw) });
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void reload();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  const today = stored && stored.clubId === clubId ? stored.today : null;
  return { today, loading, error, reload };
}

/**
 * `GET /clubs/:clubId/search?q=` with a 350 ms debounce. Fewer than 2 characters sends nothing (the server would answer
 * `query_too_short`). The text is only sent, never stored or logged; older answers never overwrite newer ones.
 */
export function useClubSearch(clubId: string | null, query: string) {
  const q = query.trim();
  const active = !!clubId && q.length >= SEARCH_MIN_CHARS;
  const [results, setResults] = useState<{ key: string; data: SearchResults } | null>(null);
  const [failed, setFailed] = useState<{ key: string; error: unknown } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${clubId}:${q}:${retry}`;

  useEffect(() => {
    if (!active || !clubId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      apiFetch<unknown>(`/clubs/${encodeURIComponent(clubId)}/search?q=${encodeURIComponent(q)}&limit=5`)
        .then((raw) => {
          if (!cancelled) {
            setResults({ key, data: parseSearch(raw) });
            setFailed(null);
          }
        })
        .catch((error) => {
          if (!cancelled) setFailed({ key, error });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, clubId, q, key]);

  const data = active && results?.key === key ? results.data : null;
  const error = active && failed?.key === key ? failed.error : null;
  return { results: data, error, loading: active && !data && !error, retry: () => setRetry((n) => n + 1), tooShort: q.length > 0 && q.length < SEARCH_MIN_CHARS };
}
