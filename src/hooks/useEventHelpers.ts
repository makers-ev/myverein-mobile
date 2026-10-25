import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import { helpersPath, subjectQuery, type HelperPlan } from '@/lib/helpers';
import { useScopedResource } from './useScopedResource';

/**
 * Helper plan of one event (`GET /events/:id/helpers`, Wave 12 M6) plus the self-service actions. `eventId = null` disables
 * it. The plan is re-read after every action (the server is the truth for capacity and swaps); the newest read wins
 * (`useScopedResource`). Actions for a ward pass the ward's club member id as `subject` (`null` = the caller).
 */
export function useEventHelpers(clubId: string | null, eventId: string | null) {
  const path = clubId && eventId ? helpersPath(eventId, clubId) : null;
  const resource = useScopedResource<HelperPlan>(path);
  const { reload } = resource;
  const club = clubId ?? '';

  const signUp = useCallback(
    async (shiftId: string, subject: string | null) => {
      await apiFetch(`/shifts/${encodeURIComponent(shiftId)}/signup?clubId=${encodeURIComponent(club)}`, {
        method: 'POST',
        body: subject ? { clubMemberId: subject } : {},
      });
      await reload();
    },
    [club, reload],
  );

  const withdraw = useCallback(
    async (shiftId: string, subject: string | null) => {
      await apiFetch(`/shifts/${encodeURIComponent(shiftId)}/signup?${subjectQuery(club, subject)}`, { method: 'DELETE' });
      await reload();
    },
    [club, reload],
  );

  /** "Abgeben" (`toClubMemberId = null`, open for everybody) or "Tauschen mit X". */
  const offerSwap = useCallback(
    async (shiftId: string, subject: string | null, toClubMemberId: string | null) => {
      await apiFetch(`/shifts/${encodeURIComponent(shiftId)}/swaps?clubId=${encodeURIComponent(club)}`, {
        method: 'POST',
        body: { ...(subject ? { clubMemberId: subject } : {}), ...(toClubMemberId ? { toClubMemberId } : {}) },
      });
      await reload();
    },
    [club, reload],
  );

  const acceptSwap = useCallback(
    async (swapId: string, subject: string | null) => {
      await apiFetch(`/swaps/${encodeURIComponent(swapId)}/accept?clubId=${encodeURIComponent(club)}`, {
        method: 'POST',
        body: subject ? { clubMemberId: subject } : {},
      });
      await reload();
    },
    [club, reload],
  );

  const declineSwap = useCallback(
    async (swapId: string) => {
      await apiFetch(`/swaps/${encodeURIComponent(swapId)}/decline?clubId=${encodeURIComponent(club)}`, { method: 'POST', body: {} });
      await reload();
    },
    [club, reload],
  );

  const withdrawSwap = useCallback(
    async (swapId: string) => {
      await apiFetch(`/swaps/${encodeURIComponent(swapId)}?clubId=${encodeURIComponent(club)}`, { method: 'DELETE' });
      await reload();
    },
    [club, reload],
  );

  return { ...resource, signUp, withdraw, offerSwap, acceptSwap, declineSwap, withdrawSwap };
}
