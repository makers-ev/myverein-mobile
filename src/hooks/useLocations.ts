import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

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
  memberId: string;
}

export interface WifiNetwork {
  id: string;
  locationId: string;
  label: string;
  ssid: string;
  password: string;
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
  const [location, setLocation] = useState<(Location & { keyHolders: LocationKeyHolder[] }) | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [links, setLinks] = useState<LocationLink[]>([]);
  const [loading, setLoading] = useState(!!(clubId && locationId));

  const refetch = useCallback(async () => {
    if (!clubId || !locationId) {
      setLocation(null);
      setWifiNetworks([]);
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [locationRes, wifiRes, linksRes] = await Promise.all([
        apiFetch<{ data: Location & { keyHolders: LocationKeyHolder[] } }>(`/locations/${locationId}?clubId=${clubId}`),
        apiFetch<{ data: WifiNetwork[] }>(`/locations/${locationId}/wifi?clubId=${clubId}`),
        apiFetch<{ data: LocationLink[] }>(`/locations/${locationId}/links?clubId=${clubId}`),
      ]);
      setLocation(locationRes.data);
      setWifiNetworks(wifiRes.data);
      setLinks(linksRes.data);
    } finally {
      setLoading(false);
    }
  }, [clubId, locationId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { location, wifiNetworks, links, loading, refetch };
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
  visibleToGuests: boolean;
}

export interface LocationLinkInput {
  title: string;
  url: string;
  visibleToGuests: boolean;
}

/** Mutation-shaped hook for `locations:write` actions (location, WiFi and link CRUD). */
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

  return { createLocation, updateLocation, deleteLocation, createWifi, updateWifi, deleteWifi, createLink, updateLink, deleteLink };
}
