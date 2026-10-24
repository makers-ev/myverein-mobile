import { useCallback, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { AgendaItem, AttendanceMember, BallotSummary, InvitationContent, InviteeRow, MinutesView, ProxyRow, Quorum, VotingRollMe } from '@/lib/assembly';
import type { Meeting } from './useMeetings';
import { useScopedResource } from './useScopedResource';

const q = (clubId: string | null) => (clubId ? `clubId=${encodeURIComponent(clubId)}` : '');
const base = (clubId: string | null, meetingId: string | null, tail: string) => (clubId && meetingId ? `/meetings/${encodeURIComponent(meetingId)}${tail}?${q(clubId)}` : null);

/**
 * Member view of one general assembly (Wave 11 M2/M4): meeting, newest invitation (agenda, time, place), announced agenda,
 * own voting right, proxies, the ballots of the meeting, the visible minutes, plus the self-service actions (RSVP, give / withdraw a
 * proxy, join / leave online). Every part loads on its own, so a missing invitation (404) or a failed part never blanks the rest.
 * Reads only what the backend lets this caller see; nothing is persisted or logged.
 */
export function useAssembly(clubId: string | null, meetingId: string | null) {
  const meeting = useScopedResource<Meeting>(base(clubId, meetingId, ''));
  const invitation = useScopedResource<InvitationContent>(base(clubId, meetingId, '/invitations/latest'));
  const agenda = useScopedResource<AgendaItem[]>(base(clubId, meetingId, '/agenda-items'));
  const invitees = useScopedResource<InviteeRow[]>(base(clubId, meetingId, '/invitees'));
  const proxies = useScopedResource<ProxyRow[]>(base(clubId, meetingId, '/proxies'));
  const roll = useScopedResource<VotingRollMe>(base(clubId, meetingId, '/voting-roll/me'));
  const quorum = useScopedResource<Quorum>(base(clubId, meetingId, '/quorum'));
  const minutes = useScopedResource<MinutesView>(base(clubId, meetingId, '/minutes'));
  const ballots = useScopedResource<BallotSummary[]>(clubId && meetingId ? `/ballots?${q(clubId)}&meetingId=${encodeURIComponent(meetingId)}` : null);
  const [acting, setActing] = useState(false);

  const act = useCallback(async (fn: () => Promise<unknown>, after: (() => Promise<unknown>)[]) => {
    setActing(true);
    try {
      await fn();
    } finally {
      setActing(false);
      void Promise.all(after.map((f) => f()));
    }
  }, []);

  /** RSVP: `PATCH /meetings/:id/invitees/me`. Rejections are shown inline by the caller. */
  const respond = useCallback(
    (response: 'zugesagt' | 'abgesagt') =>
      act(() => apiFetch(`/meetings/${meetingId}/invitees/me?${q(clubId)}`, { method: 'PATCH', body: { response } }), [invitees.reload]),
    [act, clubId, meetingId, invitees.reload],
  );

  /** Give the own proxy to another member of the club (`POST /meetings/:id/proxies`, self-service). */
  const grantProxy = useCallback(
    (holderClubMemberId: string) =>
      act(() => apiFetch(`/meetings/${meetingId}/proxies?${q(clubId)}`, { method: 'POST', body: { holderClubMemberId } }), [proxies.reload, roll.reload, quorum.reload]),
    [act, clubId, meetingId, proxies.reload, roll.reload, quorum.reload],
  );

  const revokeProxy = useCallback(
    (grantorClubMemberId: string) =>
      act(() => apiFetch(`/meetings/${meetingId}/proxies/${encodeURIComponent(grantorClubMemberId)}?${q(clubId)}`, { method: 'DELETE' }), [proxies.reload, quorum.reload]),
    [act, clubId, meetingId, proxies.reload, quorum.reload],
  );

  const setOnline = useCallback(
    (join: boolean) => act(() => apiFetch(`/meetings/${meetingId}/online/${join ? 'join' : 'leave'}?${q(clubId)}`, { method: 'POST' }), [quorum.reload, ballots.reload]),
    [act, clubId, meetingId, quorum.reload, ballots.reload],
  );

  const reloadAll = useCallback(
    () => Promise.all([meeting, invitation, agenda, invitees, proxies, roll, quorum, minutes, ballots].map((r) => r.reload())),
    [meeting, invitation, agenda, invitees, proxies, roll, quorum, minutes, ballots],
  );

  return {
    meeting: meeting.data,
    meetingLoading: meeting.loading,
    meetingError: meeting.error,
    invitation: invitation.data,
    agenda: agenda.data ?? [],
    invitees: invitees.data ?? [],
    proxies: proxies.data ?? [],
    roll: roll.data,
    quorum: quorum.data,
    minutes: minutes.data,
    ballots: ballots.data ?? [],
    ballotsLoading: ballots.loading,
    ballotsError: ballots.error,
    acting,
    respond,
    grantProxy,
    revokeProxy,
    joinOnline: () => setOnline(true),
    leaveOnline: () => setOnline(false),
    reloadAll,
  };
}

/**
 * Check-in for the secretary (Wave 11 M3; needs `assembly:manage` or `meetings:write`): invitees and attendance by club member id
 * (members without an account included), the live quorum, check-in / leave / return. The caller searches the built list locally.
 * Writes are serialised so rapid taps cannot interleave; every write reloads the attendance and the quorum.
 */
export function useCheckIn(clubId: string | null, meetingId: string | null, enabled: boolean) {
  const gate = (p: string | null) => (enabled ? p : null);
  const invitees = useScopedResource<InviteeRow[]>(gate(base(clubId, meetingId, '/invitees')));
  const attendance = useScopedResource<AttendanceMember[]>(gate(base(clubId, meetingId, '/attendance')));
  const quorum = useScopedResource<Quorum>(gate(base(clubId, meetingId, '/quorum')));
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);

  const setPresent = useCallback(
    async (clubMemberId: string, present: boolean) => {
      if (busy.current) return false;
      busy.current = true;
      setPending(clubMemberId);
      try {
        await apiFetch(`/meetings/${meetingId}/attendance?${q(clubId)}`, { method: 'PATCH', body: [{ clubMemberId, present }] });
        await Promise.all([attendance.reload(), quorum.reload()]);
        return true;
      } finally {
        busy.current = false;
        setPending(null);
      }
    },
    [clubId, meetingId, attendance, quorum],
  );

  return {
    invitees: invitees.data ?? [],
    attendance: attendance.data ?? [],
    quorum: quorum.data,
    loading: invitees.loading || attendance.loading,
    error: invitees.error || attendance.error,
    pending,
    setPresent,
    reload: () => Promise.all([invitees.reload(), attendance.reload(), quorum.reload()]),
  };
}

export interface ExpiringRole {
  id: string;
  clubMemberId: string | null;
  name: string | null;
  roleType: string;
  termEndsAt: string | null;
  termStatus: string;
  termDaysLeft?: number | null;
}

/** `GET /club-roles/expiring` (assembly:manage / roles:write): board roles whose term ended or ends soon. */
export function useExpiringTerms(clubId: string | null, enabled: boolean) {
  const { data, loading, error, reload } = useScopedResource<ExpiringRole[]>(enabled && clubId ? `/club-roles/expiring?${q(clubId)}` : null);
  return { roles: data ?? [], loading, error, reload };
}
