import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

export const MEMBER_STATUSES = ['interessent', 'probe', 'aktiv', 'ruhend', 'ausgetreten', 'ausgeschlossen', 'verstorben'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** Statuses that still count as "in the club" (what a plain member gets to see by default). */
export const LIVE_MEMBER_STATUSES: readonly MemberStatus[] = ['probe', 'aktiv', 'ruhend'];

export interface ClubMemberRole {
  id: string;
  roleType: string;
  departmentId: string | null;
  termEndsAt: string | null;
}

export interface ClubMemberDepartment {
  id: string;
  name: string;
  since: string;
  /** `null` = still assigned; a date = assignment ended. */
  until: string | null;
}

export interface ClubMemberCategory {
  id: string;
  key: string;
  name: string;
  votingRight: boolean;
}

/**
 * Member shape of the backend's Wave 7 contract (README "Club members API
 * contract"). `id` is `club_members.id`; `memberId` is the Better Auth
 * `member.id` (null = member without account) and is what meetings, loans and
 * roles still reference.
 */
export interface ClubMember {
  id: string;
  memberId: string | null;
  userId: string | null;
  hasAccount: boolean;
  name: string | null;
  /** Optional, only on a backend that knows the name fields (older: absent = unknown/empty). `name` is the display name. */
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  /** Stored status -- show/filter `effectiveStatus` instead. */
  status: MemberStatus;
  effectiveStatus: MemberStatus;
  /** Category KEY (string), not an object. */
  category: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryObject: ClubMemberCategory | null;
  joinedAt: string | null;
  leftAt: string | null;
  orgRole: string | null;
  roles: ClubMemberRole[];
  departments: ClubMemberDepartment[];
  // Only present for the own row or with members:read_sensitive -- a missing
  // (undefined) field means "not delivered" and must not be rendered.
  email?: string | null;
  contactEmail?: string | null;
  memberNumber?: string | null;
  birthDate?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  /**
   * Short-lived signed photo URL (B13/B18) or null. Only delivered for the own row, `members:write`,
   * `members:read_sensitive` and linked guardians. Never persisted; on an image load error the resource is refetched once.
   */
  photoUrl?: string | null;
  // Only on GET /club-members/me: the caller's ClubPermission list and own club_members.id.
  permissions?: string[];
  clubMemberId?: string;
}

interface MemberPage {
  data: ClubMember[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ClubMemberFilters {
  /** Free-text search, handled server-side (name; more only with members:read_sensitive). */
  q?: string;
  /** Filter on the effective status; empty/undefined = all. */
  status?: readonly MemberStatus[];
  /** Category keys; empty/undefined = all. */
  category?: readonly string[];
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 30;

function buildQuery(clubId: string, filters: ClubMemberFilters, page: number): string {
  const parts = [`clubId=${encodeURIComponent(clubId)}`, `page=${page}`, `pageSize=${filters.pageSize ?? DEFAULT_PAGE_SIZE}`];
  const q = filters.q?.trim();
  if (q) parts.push(`q=${encodeURIComponent(q)}`);
  if (filters.status && filters.status.length > 0) parts.push(`status=${encodeURIComponent(filters.status.join(','))}`);
  if (filters.category && filters.category.length > 0) parts.push(`category=${encodeURIComponent(filters.category.join(','))}`);
  return parts.join('&');
}

/**
 * Paged fetch-shaped hook for `GET /club-members?clubId=&q=&status=&category=&page=&pageSize=`
 * (response `{ data, page, pageSize, total }`). Page 1 loads on mount and on
 * every filter/club change; `loadMore()` appends the next page ("Mehr laden").
 * Only the newest request may write state (`requestId`), so a stale page or a
 * response for an old filter can never overwrite newer data.
 */
export function useClubMembers(clubId: string | null, filters: ClubMemberFilters = {}) {
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(!!clubId);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  const requestId = useRef(0);
  const pageRef = useRef(1);

  // Stable primitive key so a new `filters` object with equal content doesn't refetch.
  const filterKey = JSON.stringify([filters.q?.trim() ?? '', filters.status ?? [], filters.category ?? [], filters.pageSize ?? DEFAULT_PAGE_SIZE]);

  const currentKey = `${clubId ?? ''}|${filterKey}`;

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    const parsed = JSON.parse(filterKey) as [string, MemberStatus[], string[], number];
    const active: ClubMemberFilters = { q: parsed[0], status: parsed[1], category: parsed[2], pageSize: parsed[3] };
    pageRef.current = 1;
    setLoadingMore(false);
    setLoadMoreError(false);
    if (!clubId) {
      setMembers([]);
      setTotal(0);
      setFetching(false);
      setSettledKey(null);
      return;
    }
    setFetching(true);
    setError(false);
    try {
      const res = await apiFetch<MemberPage>(`/club-members?${buildQuery(clubId, active, 1)}`);
      if (id !== requestId.current) return;
      setMembers(res.data);
      setTotal(res.total);
    } catch {
      if (id !== requestId.current) return;
      setMembers([]);
      setTotal(0);
      setError(true);
    } finally {
      if (id === requestId.current) {
        setFetching(false);
        setSettledKey(`${clubId ?? ''}|${filterKey}`);
      }
    }
  }, [clubId, filterKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Drop the previous club's members right away; the ScrollView above is keyed per club too.
  useEffect(() => {
    setMembers([]);
    setTotal(0);
  }, [clubId]);

  // Derived synchronously: true from the first render with a new club/filter, so no empty-state flash.
  const loading = fetching || (!!clubId && settledKey !== currentKey);
  const hasMore = members.length < total;

  const loadMore = useCallback(async () => {
    if (!clubId || loading || loadingMore || !hasMore) return;
    const id = ++requestId.current;
    const parsed = JSON.parse(filterKey) as [string, MemberStatus[], string[], number];
    const active: ClubMemberFilters = { q: parsed[0], status: parsed[1], category: parsed[2], pageSize: parsed[3] };
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const res = await apiFetch<MemberPage>(`/club-members?${buildQuery(clubId, active, nextPage)}`);
      if (id !== requestId.current) return;
      pageRef.current = nextPage;
      setMembers((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...res.data.filter((m) => !seen.has(m.id))];
      });
      setTotal(res.total);
    } catch {
      if (id === requestId.current) setLoadMoreError(true);
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [clubId, filterKey, loading, loadingMore, hasMore]);

  return { members, total, loading, loadingMore, error, loadMoreError, hasMore, refetch, loadMore };
}

const DIRECTORY_PAGE_SIZE = 100;
const DIRECTORY_MAX_PAGES = 50;

/**
 * Whole member list for name lookups (e.g. meeting invitees). `GET /club-members`
 * is paged, so this walks all pages (100 each) instead of silently stopping
 * at the first. Deliberately has no filters; use `useClubMembers` for lists.
 */
export function useClubMemberDirectory(clubId: string | null) {
  const [stored, setStored] = useState<{ clubId: string; members: ClubMember[] } | null>(null);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) return;
    try {
      const all: ClubMember[] = [];
      let page = 1;
      let total = 0;
      do {
        const res = await apiFetch<MemberPage>(`/club-members?clubId=${encodeURIComponent(clubId)}&page=${page}&pageSize=${DIRECTORY_PAGE_SIZE}`);
        if (id !== requestId.current) return;
        all.push(...res.data);
        total = res.total;
        page += 1;
        if (res.data.length === 0) break;
      } while (all.length < total && page <= DIRECTORY_MAX_PAGES);
      setStored({ clubId, members: all });
    } catch {
      // Names fall back to ids in the UI; nothing else depends on this list.
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const members = stored && stored.clubId === clubId ? stored.members : [];
  return { members, refetch };
}

export interface MemberCategoryOption {
  id: string;
  key: string;
  name: string;
}

/** Fetch-shaped hook for `GET /club-members/categories?clubId=` (non-archived categories, readable by every member). */
export function useMemberCategories(clubId: string | null, enabled = true) {
  const [stored, setStored] = useState<{ clubId: string; categories: MemberCategoryOption[] } | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    if (!clubId || !enabled) return;
    apiFetch<{ data: MemberCategoryOption[] }>(`/club-members/categories?clubId=${encodeURIComponent(clubId)}`)
      .then((res) => {
        if (id === requestId.current) setStored({ clubId, categories: res.data });
      })
      .catch(() => {
        // Without categories the filter row is simply hidden.
      });
  }, [clubId, enabled]);

  return { categories: stored && stored.clubId === clubId ? stored.categories : [] };
}

const SEARCH_PAGE_SIZE = 30;

/**
 * Server-side member search for pickers: `GET /club-members?q=&hasAccount=true&status=probe,aktiv,ruhend&pageSize=30`.
 * Makes no request while `enabled` is false (e.g. the picker sheet is closed). Failures (incl. 429) are exposed
 * as `error` for a visible retry. Only the newest request may write state.
 */
export function useMemberSearch(clubId: string | null, query: string, enabled: boolean) {
  const [stored, setStored] = useState<{ key: string; members: ClubMember[]; total: number } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);
  const q = query.trim();
  const key = `${clubId ?? ''}|${q}`;

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    setError(null);
    if (!clubId || !enabled) {
      setFetching(false);
      return;
    }
    setFetching(true);
    try {
      const parts = [
        `clubId=${encodeURIComponent(clubId)}`,
        'hasAccount=true',
        `status=${LIVE_MEMBER_STATUSES.join(',')}`,
        `pageSize=${SEARCH_PAGE_SIZE}`,
        'page=1',
      ];
      if (q) parts.push(`q=${encodeURIComponent(q)}`);
      const res = await apiFetch<MemberPage>(`/club-members?${parts.join('&')}`);
      if (id === requestId.current) setStored({ key: `${clubId}|${q}`, members: res.data, total: res.total });
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setFetching(false);
    }
  }, [clubId, q, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const current = enabled && stored && stored.key === key ? stored : null;
  const loading = enabled && !!clubId && !error && (fetching || !current);
  return { members: current?.members ?? [], total: current?.total ?? 0, loading, error, refetch };
}
