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
