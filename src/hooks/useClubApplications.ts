import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import {
  type ApplicationPage,
  type ApplicationReview,
  type ApproveResult,
  approveBody,
  APPLICATIONS_PAGE_SIZE,
  type ClubApplication,
  clampPage,
  listQuery,
  rejectBody,
} from '@/lib/applicationReview';

export type { ClubApplication } from '@/lib/applicationReview';

/**
 * Fetch-shaped hook for the board's list of open applications (`GET /club-applications?clubId=&page=&pageSize=`, needs
 * `members:write`; `{ data, page, pageSize, total }`) plus the decisions (`POST /club-applications/:id/approve|reject`).
 * Race protection: the data is stored together with its club and page, and only the newest request may write -- a club
 * switch, a page change or a decision bumps `requestId`, so an older in-flight fetch can never resurrect stale rows.
 * A decision reloads the list silently (the deciding row disappears; an emptied last page falls back to the previous one);
 * a failed reload keeps the old rows with `error`. Nothing is cached or persisted.
 */
export function useClubApplications(clubId: string | null) {
  const [stored, setStored] = useState<{ clubId: string; data: ApplicationPage } | null>(null);
  // Kept together with the club it belongs to, so the page of another club never leaks in.
  const [pageState, setPageState] = useState<{ clubId: string | null; page: number }>({ clubId, page: 1 });
  const page = pageState.clubId === clubId ? pageState.page : 1;
  const [loading, setLoading] = useState(!!clubId);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!clubId) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError(false);
      try {
        const res = await apiFetch<ApplicationPage>(`/club-applications?${listQuery(clubId, page)}`);
        if (id !== requestId.current) return;
        const clamped = clampPage(page, res.total, res.pageSize || APPLICATIONS_PAGE_SIZE);
        if (clamped !== page) {
          // Decisions emptied this page: show the last one that exists (the effect below loads it).
          setPageState({ clubId, page: clamped });
          return;
        }
        setStored({ clubId, data: res });
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [clubId, page],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const goToPage = useCallback(
    (next: number) => {
      if (clubId) setPageState({ clubId, page: Math.max(1, Math.trunc(next)) });
    },
    [clubId],
  );

  const data = stored && stored.clubId === clubId ? stored.data : null;
  const applications: ClubApplication[] = data?.data ?? [];

  const approve = useCallback(
    async (id: string, categoryId = ''): Promise<ApproveResult | undefined> => {
      if (!clubId) return undefined;
      const res = await apiFetch<{ data?: ApproveResult }>(`/club-applications/${encodeURIComponent(id)}/approve?clubId=${encodeURIComponent(clubId)}`, {
        method: 'POST',
        body: approveBody(categoryId),
      });
      void refetch(true);
      return res?.data;
    },
    [clubId, refetch],
  );

  const reject = useCallback(
    async (id: string, note = '', applicantMessage = ''): Promise<void> => {
      if (!clubId) return;
      await apiFetch(`/club-applications/${encodeURIComponent(id)}/reject?clubId=${encodeURIComponent(clubId)}`, {
        method: 'POST',
        body: rejectBody(note, applicantMessage),
      });
      void refetch(true);
    },
    [clubId, refetch],
  );

  return {
    applications,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? APPLICATIONS_PAGE_SIZE,
    total: data?.total ?? 0,
    loading,
    error,
    refetch,
    goToPage,
    approve,
    reject,
  };
}

/**
 * `GET /club-applications/:id?clubId=` -- one application with its answers rendered against the form version the person
 * filled in (protected answers redacted without `members:read_sensitive`), mapping preview, files (authenticated
 * `path`s, never URLs), consent evidence, duplicates and warnings. Keyed by club + application: a late answer for another
 * application is dropped (`requestId` guard), switching application starts from `null`.
 */
export function useApplicationReview(clubId: string | null, applicationId: string | null) {
  const [stored, setStored] = useState<{ key: string; review: ApplicationReview } | null>(null);
  const key = clubId && applicationId ? `${clubId}:${applicationId}` : null;
  const [loading, setLoading] = useState(!!key);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId || !applicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: ApplicationReview }>(
        `/club-applications/${encodeURIComponent(applicationId)}?clubId=${encodeURIComponent(clubId)}`,
      );
      if (id === requestId.current) setStored({ key: `${clubId}:${applicationId}`, review: res.data });
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, applicationId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const review = stored && stored.key === key ? stored.review : null;
  return { review, loading, error, refetch };
}
