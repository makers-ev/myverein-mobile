import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';

export interface Location {
  id: string;
  clubId: string;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  openingHours: string | null;
  photoUrl: string | null;
  contactPerson: string | null;
  accessNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationKeyHolder {
  id: string;
  locationId: string;
  /** Better Auth `member.id` of the holder (accounts only). */
  memberId: string;
  /** Holder's name (delivered by newer backends; fall back to history/unknown). */
  memberName?: string | null;
  keyLabel?: string | null;
}

export type WifiSecurity = 'open' | 'wpa' | 'wep' | 'wpa3';
export const WIFI_SECURITIES: readonly WifiSecurity[] = ['open', 'wpa', 'wpa3', 'wep'];

export interface KeyHistoryEntry {
  id: string;
  action: 'issued' | 'returned';
  memberId: string | null;
  memberName: string;
  keyLabel: string | null;
  note: string | null;
  recordedBy: string | null;
  recordedByName: string;
  createdAt: string;
}

export interface WifiNetwork {
  id: string;
  locationId: string;
  label: string;
  ssid: string;
  password: string;
  /** Missing on older backends: treated as open/wpa derived from the password. */
  security?: WifiSecurity;
  /** Ready-made `WIFI:` string from the backend; preferred over building one locally. */
  qrPayload?: string;
  visibleToGuests: boolean;
  createdAt: string;
}

export interface LocationLink {
  id: string;
  locationId: string;
  title: string;
  url: string;
  icon: string | null;
  visibleToGuests: boolean;
  createdAt: string;
}

/** Fetch-shaped hook for `GET /locations?clubId=`, see README.md's "Adding a new API request". */
export function useLocations(clubId: string | null) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setLocations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: Location[] }>(`/locations?clubId=${clubId}`);
      setLocations(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { locations, loading, refetch };
}

/**
 * Fetch-shaped hook for a single location's detail view: the location
 * itself (with `keyHolders`), its WiFi networks, and its links, all fetched
 * in parallel via `Promise.all` and re-fetchable together via `refetch`.
 * The WiFi/links endpoints are already guest-filtered server-side (see
 * `locations.ts`'s `visibleToGuests` conditions) -- this hook renders
 * whatever comes back without any further client-side filtering.
 */
export function useLocationDetail(clubId: string | null, locationId: string | null) {
  type Detail = {
    key: string;
    location: Location & { keyHolders: LocationKeyHolder[] };
    wifiNetworks: WifiNetwork[];
    links: LocationLink[];
  };
  const [stored, setStored] = useState<Detail | null>(null);
  const [fetching, setFetching] = useState(!!(clubId && locationId));
  const [error, setError] = useState(false);
  // Only the newest request may write state.
  const requestId = useRef(0);
  const key = `${clubId ?? ''}|${locationId ?? ''}`;

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId || !locationId) {
      setFetching(false);
      return;
    }
    setFetching(true);
    setError(false);
    try {
      const [locationRes, wifiRes, linksRes] = await Promise.all([
        apiFetch<{ data: Location & { keyHolders: LocationKeyHolder[] } }>(`/locations/${locationId}?clubId=${clubId}`),
        apiFetch<{ data: WifiNetwork[] }>(`/locations/${locationId}/wifi?clubId=${clubId}`),
        apiFetch<{ data: LocationLink[] }>(`/locations/${locationId}/links?clubId=${clubId}`),
      ]);
      if (id === requestId.current) {
        setStored({ key: `${clubId}|${locationId}`, location: locationRes.data, wifiNetworks: wifiRes.data, links: linksRes.data });
      }
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setFetching(false);
    }
  }, [clubId, locationId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const current = stored && stored.key === key ? stored : null;
  // Derived: true from the first render with a new club/location, so there is no empty flash.
  const loading = fetching || (!!clubId && !!locationId && !current && !error);
  return {
    location: current?.location ?? null,
    wifiNetworks: current?.wifiNetworks ?? [],
    links: current?.links ?? [],
    loading,
    error,
    refetch,
  };
}

const KEY_HISTORY_PAGE_SIZE = 20;

/**
 * Paged key history (`GET /locations/:id/key-history`, newest first). Needs
 * `locations:write` or `locations:read_access`; pass `enabled=false` otherwise
 * so no request is made. A 403 sets `forbidden` and the UI hides the section.
 * Page 1 reloads on club/location change; `loadMore` appends. Only the newest
 * request may write state.
 */
export function useKeyHistory(clubId: string | null, locationId: string | null, enabled: boolean) {
  const [stored, setStored] = useState<{ key: string; entries: KeyHistoryEntry[]; total: number; page: number } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const requestId = useRef(0);
  const key = `${clubId ?? ''}|${locationId ?? ''}`;

  const path = useCallback(
    (page: number) => `/locations/${locationId}/key-history?clubId=${clubId}&page=${page}&pageSize=${KEY_HISTORY_PAGE_SIZE}`,
    [clubId, locationId],
  );

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    setLoadingMore(false);
    setForbidden(false);
    setError(false);
    if (!clubId || !locationId || !enabled) {
      setFetching(false);
      return;
    }
    setFetching(true);
    try {
      const res = await apiFetch<{ data: KeyHistoryEntry[]; page: number; total: number }>(path(1));
      if (id === requestId.current) setStored({ key: `${clubId}|${locationId}`, entries: res.data, total: res.total, page: 1 });
    } catch (err) {
      if (id !== requestId.current) return;
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else setError(true);
    } finally {
      if (id === requestId.current) setFetching(false);
    }
  }, [clubId, locationId, enabled, path]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loading = enabled && !forbidden && !error && !!clubId && !!locationId && (fetching || stored?.key !== key);
  const current = enabled && !forbidden && stored && stored.key === key ? stored : null;
  const entries = current?.entries ?? [];
  const hasMore = !!current && entries.length < current.total;

  const loadMore = useCallback(async () => {
    if (!current || loading || loadingMore || !hasMore) return;
    const id = ++requestId.current;
    const nextPage = current.page + 1;
    setLoadingMore(true);
    setError(false);
    try {
      const res = await apiFetch<{ data: KeyHistoryEntry[]; total: number }>(path(nextPage));
      if (id !== requestId.current) return;
      setStored((prev) => {
        if (!prev || prev.key !== key) return prev;
        const seen = new Set(prev.entries.map((e) => e.id));
        return { ...prev, entries: [...prev.entries, ...res.data.filter((e) => !seen.has(e.id))], total: res.total, page: nextPage };
      });
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [current, loading, loadingMore, hasMore, path, key]);

  return { entries, loading, loadingMore, error, forbidden, hasMore, refetch, loadMore };
}

/** Body for POST/PATCH `/locations`; `null` clears a field on PATCH, create omits empty fields. */
export interface LocationInput {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: string | null;
  photoUrl?: string | null;
  contactPerson?: string | null;
  accessNote?: string | null;
}

export interface WifiNetworkInput {
  label: string;
  ssid: string;
  password: string;
  security?: WifiSecurity;
  visibleToGuests: boolean;
}

export interface LocationLinkInput {
  title: string;
  url: string;
  visibleToGuests: boolean;
}

/** Mutation-shaped hook for `locations:write` actions (location, WiFi, link CRUD, key issue/return). */
export function useLocationMutations(clubId: string | null) {
  const createLocation = useCallback(
    (input: LocationInput) => apiFetch<{ data: Location }>(`/locations?clubId=${clubId}`, { method: 'POST', body: input }),
    [clubId],
  );
  const updateLocation = useCallback(
    (locationId: string, input: LocationInput) =>
      apiFetch<{ data: Location }>(`/locations/${locationId}?clubId=${clubId}`, { method: 'PATCH', body: input }),
    [clubId],
  );
  const deleteLocation = useCallback(
    (locationId: string) => apiFetch<void>(`/locations/${locationId}?clubId=${clubId}`, { method: 'DELETE' }),
    [clubId],
  );

  const createWifi = useCallback(
    (locationId: string, input: WifiNetworkInput) =>
      apiFetch<{ data: WifiNetwork }>(`/locations/${locationId}/wifi?clubId=${clubId}`, { method: 'POST', body: input }),
    [clubId],
  );
  const updateWifi = useCallback(
    (locationId: string, wifiId: string, input: WifiNetworkInput) =>
      apiFetch<{ data: WifiNetwork }>(`/locations/${locationId}/wifi/${wifiId}?clubId=${clubId}`, { method: 'PATCH', body: input }),
    [clubId],
  );
  const deleteWifi = useCallback(
    (locationId: string, wifiId: string) =>
      apiFetch<void>(`/locations/${locationId}/wifi/${wifiId}?clubId=${clubId}`, { method: 'DELETE' }),
    [clubId],
  );

  const createLink = useCallback(
    (locationId: string, input: LocationLinkInput) =>
      apiFetch<{ data: LocationLink }>(`/locations/${locationId}/links?clubId=${clubId}`, { method: 'POST', body: input }),
    [clubId],
  );
  const updateLink = useCallback(
    (locationId: string, linkId: string, input: LocationLinkInput) =>
      apiFetch<{ data: LocationLink }>(`/locations/${locationId}/links/${linkId}?clubId=${clubId}`, { method: 'PATCH', body: input }),
    [clubId],
  );
  const deleteLink = useCallback(
    (locationId: string, linkId: string) =>
      apiFetch<void>(`/locations/${locationId}/links/${linkId}?clubId=${clubId}`, { method: 'DELETE' }),
    [clubId],
  );

  const issueKey = useCallback(
    (locationId: string, input: { memberId: string; keyLabel?: string; note?: string }) =>
      apiFetch<{ data: LocationKeyHolder }>(`/locations/${locationId}/key-holders?clubId=${clubId}`, { method: 'POST', body: input }),
    [clubId],
  );
  const returnKey = useCallback(
    (locationId: string, memberId: string, note?: string) =>
      apiFetch<void>(`/locations/${locationId}/key-holders/${encodeURIComponent(memberId)}?clubId=${clubId}`, {
        method: 'DELETE',
        body: note ? { note } : undefined,
      }),
    [clubId],
  );

  return { issueKey, returnKey, createLocation, updateLocation, deleteLocation, createWifi, updateWifi, deleteWifi, createLink, updateLink, deleteLink };
}
