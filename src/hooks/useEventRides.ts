import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import type { RequestStatus, RidesView } from '@/lib/rides';
import { useScopedResource } from './useScopedResource';

/** Rides of one event (`/events/:id/rides`, Wave 12 P2): list plus offer / request / decide actions; each action re-reads the list. */
export function useEventRides(clubId: string | null, eventId: string | null) {
  const club = encodeURIComponent(clubId ?? '');
  const base = eventId ? `/events/${encodeURIComponent(eventId)}/rides` : null;
  const resource = useScopedResource<RidesView>(clubId && base ? `${base}?clubId=${club}` : null);
  const { reload } = resource;

  const offer = useCallback(
    async (body: { seats: number; departurePlace: string; departureAt?: string; note?: string }) => {
      await apiFetch(`${base}?clubId=${club}`, { method: 'POST', body });
      await reload();
    },
    [base, club, reload],
  );

  const removeRide = useCallback(
    async (rideId: string) => {
      await apiFetch(`${base}/${encodeURIComponent(rideId)}?clubId=${club}`, { method: 'DELETE' });
      await reload();
    },
    [base, club, reload],
  );

  /** Asks for a seat for the caller or - for a minor / ward - the ward's club member id. */
  const requestSeat = useCallback(
    async (rideId: string, subject: string | null) => {
      await apiFetch(`${base}/${encodeURIComponent(rideId)}/requests?clubId=${club}`, {
        method: 'POST',
        body: subject ? { clubMemberId: subject } : {},
      });
      await reload();
    },
    [base, club, reload],
  );

  const decide = useCallback(
    async (rideId: string, requestId: string, status: Exclude<RequestStatus, 'angefragt'>) => {
      await apiFetch(`${base}/${encodeURIComponent(rideId)}/requests/${encodeURIComponent(requestId)}?clubId=${club}`, {
        method: 'PATCH',
        body: { status },
      });
      await reload();
    },
    [base, club, reload],
  );

  const removeRequest = useCallback(
    async (rideId: string, requestId: string) => {
      await apiFetch(`${base}/${encodeURIComponent(rideId)}/requests/${encodeURIComponent(requestId)}?clubId=${club}`, { method: 'DELETE' });
      await reload();
    },
    [base, club, reload],
  );

  return { ...resource, offer, removeRide, requestSeat, decide, removeRequest };
}
