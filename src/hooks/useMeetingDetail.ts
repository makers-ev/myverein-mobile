import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { Meeting, MeetingPatch } from './useMeetings';

/** Freitext-Beispiele: "ausstehend" | "zugesagt" | "abgesagt", see meetings.ts schema. */
export interface MeetingInvitee {
  id: string;
  meetingId: string;
  memberId: string;
  response: string;
}

/**
 * One entry of `PATCH /meetings/:id/attendance` (partial update, B17): only the listed members and only the
 * fields present are written. `proxyForMemberId: null` clears a Vollmacht; omitting a field keeps the stored value.
 */
export interface AttendanceEntry {
  memberId: string;
  present?: boolean;
  hasVotingRight?: boolean;
  proxyForMemberId?: string | null;
}

/** Stored row from `GET /meetings/:id/attendance` (pre-fills the form). */
export interface AttendanceRow {
  memberId: string;
  present: boolean;
  hasVotingRight: boolean;
  proxyForMemberId: string | null;
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

interface DetailData {
  key: string;
  meeting: Meeting;
  invitees: MeetingInvitee[];
  resolutions: MeetingResolution[];
  attendance: AttendanceRow[];
}

/**
 * Fetch-shaped hook for one meeting's detail: `GET /meetings/:id` + `/invitees` + `/resolutions` + `/attendance`
 * (Promise.all), plus the board/self-service actions the detail view needs. `getOverlap` is called on demand,
 * not auto-fetched, since candidates are picked interactively. Club/meeting-aware and race-safe: data for a
 * different club/meeting is never exposed and only the newest request may write state.
 */
export function useMeetingDetail(clubId: string | null, meetingId: string | null) {
  const key = clubId && meetingId ? `${clubId}|${meetingId}` : null;
  const [data, setData] = useState<DetailData | null>(null);
  const current = data && data.key === key ? data : null;
  const [loading, setLoading] = useState(!!key);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId || !meetingId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    const c = encodeURIComponent(clubId);
    try {
      const [meetingRes, inviteesRes, resolutionsRes, attendanceRes] = await Promise.all([
        apiFetch<{ data: Meeting }>(`/meetings/${meetingId}?clubId=${c}`),
        apiFetch<{ data: MeetingInvitee[] }>(`/meetings/${meetingId}/invitees?clubId=${c}`),
        apiFetch<{ data: MeetingResolution[] }>(`/meetings/${meetingId}/resolutions?clubId=${c}`),
        apiFetch<{ data: AttendanceRow[] }>(`/meetings/${meetingId}/attendance?clubId=${c}`),
      ]);
      if (id !== requestId.current) return;
      setData({
        key: `${clubId}|${meetingId}`,
        meeting: meetingRes.data,
        invitees: inviteesRes.data,
        resolutions: resolutionsRes.data,
        attendance: attendanceRes.data,
      });
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId, meetingId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateMeeting = useCallback(
    async (patch: MeetingPatch) => {
      const res = await apiFetch<{ data: Meeting }>(`/meetings/${meetingId}?clubId=${clubId}`, { method: 'PATCH', body: patch });
      setData((prev) => (prev && prev.key === key ? { ...prev, meeting: res.data } : prev));
      return res.data;
    },
    [clubId, meetingId, key],
  );

  const deleteMeeting = useCallback(async () => {
    await apiFetch(`/meetings/${meetingId}?clubId=${clubId}`, { method: 'DELETE' });
  }, [clubId, meetingId]);

  /** Invite a member (`meetings:write`); `memberId` is the Better Auth member id (accounts only). */
  const addInvitee = useCallback(
    async (memberId: string) => {
      await apiFetch(`/meetings/${meetingId}/invitees?clubId=${clubId}`, { method: 'POST', body: { memberId } });
      await refetch();
    },
    [clubId, meetingId, refetch],
  );

  const removeInvitee = useCallback(
    async (memberId: string) => {
      await apiFetch(`/meetings/${meetingId}/invitees/${encodeURIComponent(memberId)}?clubId=${clubId}`, { method: 'DELETE' });
      await refetch();
    },
    [clubId, meetingId, refetch],
  );

  const respondToInvite = useCallback(
    async (response: 'zugesagt' | 'abgesagt') => {
      await apiFetch(`/meetings/${meetingId}/invitees/me?clubId=${clubId}`, { method: 'PATCH', body: { response } });
      await refetch();
    },
    [clubId, meetingId, refetch],
  );

  // Partial update: the caller sends only what changed; the response carries the stored rows, which replace the pre-fill.
  const recordAttendance = useCallback(
    async (entries: AttendanceEntry[]) => {
      const res = await apiFetch<{ data: AttendanceRow[] }>(`/meetings/${meetingId}/attendance?clubId=${clubId}`, {
        method: 'PATCH',
        body: entries,
      });
      setData((prev) => (prev && prev.key === key ? { ...prev, attendance: res.data } : prev));
    },
    [clubId, meetingId, key],
  );

  const createResolution = useCallback(
    async (body: ResolutionInput) => {
      const res = await apiFetch<{ data: MeetingResolution }>(`/meetings/${meetingId}/resolutions?clubId=${clubId}`, {
        method: 'POST',
        body,
      });
      setData((prev) => (prev && prev.key === key ? { ...prev, resolutions: [...prev.resolutions, res.data] } : prev));
      return res.data;
    },
    [clubId, meetingId, key],
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
    meeting: current?.meeting ?? null,
    invitees: current?.invitees ?? [],
    resolutions: current?.resolutions ?? [],
    attendance: current?.attendance ?? [],
    loading,
    error,
    refetch,
    updateMeeting,
    deleteMeeting,
    addInvitee,
    removeInvitee,
    respondToInvite,
    recordAttendance,
    createResolution,
    getOverlap,
  };
}
