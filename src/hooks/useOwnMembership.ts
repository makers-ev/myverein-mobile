import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { dropOfflineClubIfDenied } from '@/lib/offlineCache';
import type { ClubMember } from './useClubMembers';

export type ClubPermission =
  | 'members:write'
  | 'members:read_sensitive'
  | 'forms:write'
  | 'roles:write'
  | 'departments:write'
  | 'club_info:write'
  | 'calendars:write'
  | 'meetings:write'
  | 'locations:write'
  | 'inventory:write'
  | 'meetings:read_board'
  | 'locations:read_access'
  // Wave 10: absences of the caller's scope (trainers: own departments), privacy admin (audit log, consents overview).
  | 'absences:read'
  | 'privacy:read'
  | 'privacy:manage'
  // Wave 11: assembly management (invitations, voting roll, ballots, minutes); members vote/RSVP without it.
  | 'assembly:manage'
  // Wave 12: attendance lists, participant lists, helper plan management, time tracking (department scope for trainers / Abteilungsleitung).
  | 'attendance:write'
  | 'attendance:read'
  | 'registrations:read'
  | 'helpers:write'
  | 'time:write'
  | 'time:read_rates'
  // Wave 13: documents/PDF/membership card. Archive access itself is decided per folder, not by a global permission.
  | 'documents:manage'
  | 'documents:write'
  | 'documents:read_personal'
  | 'documents:generate'
  | 'member_cards:verify'
  | 'member_cards:manage'
  | 'branding:write'
  | 'storage:read'
  // Not a ClubPermission in the backend, but appended to /club-members/me for UI gating (board roles).
  | 'club_stats:read';

/** Fetch-shaped hook for `GET /club-members/me?clubId=`, always includes sensitive fields (it's the caller's own row). */
export function useOwnMembership(clubId: string | null) {
  // Kept together with the club it belongs to, so a stale club's permissions are never exposed.
  const [stored, setStored] = useState<{ clubId: string; member: ClubMember } | null>(null);
  const membership = stored && stored.clubId === clubId ? stored.member : null;
  const [loading, setLoading] = useState(!!clubId);

  // Only the newest request may write state.
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: ClubMember }>(`/club-members/me?clubId=${clubId}`);
      if (id === requestId.current) setStored({ clubId, member: data });
    } catch (err) {
      // Keep no membership; can() stays false (deny by default). 403/404 = no longer a member: drop the offline copies.
      dropOfflineClubIfDenied(err, clubId);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const can = useCallback((permission: ClubPermission) => !!membership?.permissions?.includes(permission), [membership]);

  return { membership, loading, refetch, can };
}
