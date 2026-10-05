import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { Meeting, MeetingPatch } from './useMeetings';

/** Freitext-Beispiele: "ausstehend" | "zugesagt" | "abgesagt", see meetings.ts schema. */
export interface MeetingInvitee {
  id: string;
  meetingId: string;
  memberId: string;
  response: string;
}

export interface AttendanceEntry {
  memberId: string;
  present: boolean;
  hasVotingRight?: boolean;
  proxyForMemberId?: string;
}

/** `POST /meetings/:id/resolutions` body -- `result` is free-text (Freitext-Beispiele "angenommen" | "abgelehnt"). */
export interface ResolutionInput {
  description: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: string;
}

export interface MeetingResolution extends ResolutionInput {
  id: string;
  meetingId: string;
  createdAt: string;
}

export interface OverlapCandidate {
  candidate: string;
  availability: { memberId: string; available: boolean }[];
}

/**
 * Fetch-shaped hook for one meeting's detail: `GET /meetings/:id` +
 * `/invitees` + `/resolutions` (Promise.all), plus the board/self-service
 * actions the detail view needs. `getOverlap` is called on demand, not
 * auto-fetched, since candidates are picked interactively.
 */
export function useMeetingDetail(clubId: string | null, meetingId: string | null) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [invitees, setInvitees] = useState<MeetingInvitee[]>([]);
  const [resolutions, setResolutions] = useState<MeetingResolution[]>([]);
  const [loading, setLoading] = useState(!!(clubId && meetingId));

  const refetch = useCallback(async () => {
    if (!clubId || !meetingId) {
      setMeeting(null);
      setInvitees([]);
      setResolutions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [meetingRes, inviteesRes, resolutionsRes] = await Promise.all([
        apiFetch<{ data: Meeting }>(`/meetings/${meetingId}?clubId=${clubId}`),
        apiFetch<{ data: MeetingInvitee[] }>(`/meetings/${meetingId}/invitees?clubId=${clubId}`),
        apiFetch<{ data: MeetingResolution[] }>(`/meetings/${meetingId}/resolutions?clubId=${clubId}`),
      ]);
      setMeeting(meetingRes.data);
      setInvitees(inviteesRes.data);
      setResolutions(resolutionsRes.data);
    } finally {
      setLoading(false);
    }
  }, [clubId, meetingId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateMeeting = useCallback(
    async (patch: MeetingPatch) => {
      const { data } = await apiFetch<{ data: Meeting }>(`/meetings/${meetingId}?clubId=${clubId}`, { method: 'PATCH', body: patch });
      setMeeting(data);
      return data;
    },
    [clubId, meetingId],
  );

  const respondToInvite = useCallback(
    async (response: 'zugesagt' | 'abgesagt') => {
      await apiFetch(`/meetings/${meetingId}/invitees/me?clubId=${clubId}`, { method: 'PATCH', body: { response } });
      await refetch();
    },
    [clubId, meetingId, refetch],
  );

  // ponytail: doesn't prefetch GET /attendance to pre-fill toggles -- the
  // board fills the batch fresh each session. Add a fetch here if
  // pre-filling from the last save turns out to matter.
  const recordAttendance = useCallback(
    async (entries: AttendanceEntry[]) => {
      await apiFetch(`/meetings/${meetingId}/attendance?clubId=${clubId}`, { method: 'PATCH', body: entries });
    },
    [clubId, meetingId],
  );

  const createResolution = useCallback(
    async (body: ResolutionInput) => {
      const { data } = await apiFetch<{ data: MeetingResolution }>(`/meetings/${meetingId}/resolutions?clubId=${clubId}`, {
        method: 'POST',
        body,
      });
      setResolutions((prev) => [...prev, data]);
      return data;
    },
    [clubId, meetingId],
  );

  const getOverlap = useCallback(
    async (candidateIsoTimestamps: string[]) => {
      const candidates = candidateIsoTimestamps.map(encodeURIComponent).join(',');
      const { data } = await apiFetch<{ data: OverlapCandidate[] }>(
        `/meetings/${meetingId}/overlap?clubId=${clubId}&candidates=${candidates}`,
      );
      return data;
    },
    [clubId, meetingId],
  );

  return {
    meeting,
    invitees,
    resolutions,
    loading,
    refetch,
    updateMeeting,
    respondToInvite,
    recordAttendance,
    createResolution,
    getOverlap,
  };
}
