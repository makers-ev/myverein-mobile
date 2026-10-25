import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import { rsvpPath, rsvpBody, type MyRsvp, type RegistrationInfo } from '@/lib/eventRegistration';
import type { Answers } from '@/lib/formSchema';
import { useScopedResource } from './useScopedResource';

/** `GET /events/:id/registration` (Wave 12 B13): settings, form and "may I manage" for one event. `eventId = null` disables it. */
export function useEventRegistration(clubId: string | null, eventId: string | null) {
  const path = clubId && eventId ? `/events/${encodeURIComponent(eventId)}/registration?clubId=${encodeURIComponent(clubId)}` : null;
  return useScopedResource<RegistrationInfo>(path);
}

/**
 * `GET /events/:id/rsvp[?forClubMemberId=]`: the stored sign-up of the caller or one ward (prefill for "Ändern"). `data` is
 * `null` both while loading and when nobody is signed up -- use `loading` to tell them apart.
 */
export function useMyRsvp(clubId: string | null, eventId: string | null, forClubMemberId: string | null) {
  const path = clubId && eventId ? rsvpPath(eventId, clubId, forClubMemberId) : null;
  return useScopedResource<MyRsvp | null>(path);
}

/** Sign up / change / cancel for the caller (`forClubMemberId = null`) or a ward. Callers refetch afterwards. */
export function useRsvpActions(clubId: string | null) {
  const submit = useCallback(
    async (
      eventId: string,
      info: Pick<RegistrationInfo, 'form' | 'maxCompanions'>,
      input: { partySize: number; answers: Answers; forClubMemberId: string | null },
    ) => {
      const body = rsvpBody(info, input);
      const { data } = await apiFetch<{ data: { status: 'angemeldet' | 'warteliste'; partySize: number; attendeeId: string } }>(
        rsvpPath(eventId, clubId ?? '', input.forClubMemberId),
        { method: 'POST', ...(body ? { body } : {}) },
      );
      return data;
    },
    [clubId],
  );

  const cancel = useCallback(
    async (eventId: string, forClubMemberId: string | null) => {
      await apiFetch(rsvpPath(eventId, clubId ?? '', forClubMemberId), { method: 'DELETE' });
    },
    [clubId],
  );

  return { submit, cancel };
}

/** Board side of the guest link (`calendars:write`): create/replace returns the link ONCE, revoke kills it. */
export function usePublicLinkActions(clubId: string | null, eventId: string) {
  const base = `/events/${encodeURIComponent(eventId)}/public-link?clubId=${encodeURIComponent(clubId ?? '')}`;
  const create = useCallback(async () => {
    const { data } = await apiFetch<{ data: { token: string; url: string; active: boolean } }>(base, { method: 'POST' });
    return data;
  }, [base]);
  const revoke = useCallback(async () => {
    await apiFetch(base, { method: 'DELETE' });
  }, [base]);
  return { create, revoke };
}
