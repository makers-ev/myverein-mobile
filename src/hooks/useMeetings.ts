import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { withNotifyQuery } from '@/lib/notifyOptions';

export type MeetingStatus = 'terminfindung' | 'geplant' | 'abgehalten' | 'protokolliert';

/** Controlled meeting types (backend `MEETING_TYPES`, other values are a 422). Only `vorstandssitzung` is read-scoped. */
export const MEETING_TYPES = ['vorstandssitzung', 'mitgliederversammlung', 'sonstige'] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];
export const MEETING_STATUSES: readonly MeetingStatus[] = ['terminfindung', 'geplant', 'abgehalten', 'protokolliert'];

export interface Meeting {
  id: string;
  clubId: string;
  /** One of `MEETING_TYPES`; typed as string because legacy rows are mapped server-side only. */
  type: string;
  title: string;
  scheduledAt: string | null;
  agenda: string | null;
  minutes: string | null;
  status: MeetingStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** `POST /meetings` body. */
export interface MeetingInput {
  type: MeetingType;
  title: string;
  scheduledAt?: string;
}

/** `PATCH /meetings/:id` body. */
export interface MeetingPatch {
  type?: MeetingType;
  title?: string;
  scheduledAt?: string | null;
  agenda?: string | null;
  minutes?: string | null;
  status?: MeetingStatus;
  /** `false` suppresses the invitee notification of a date change / cancellation (omitted = notify). */
  notify?: boolean;
}

/**
 * Fetch-shaped hook for `GET /meetings?clubId=`, see README.md's "Adding a new API request".
 * Club-aware (a stale club's meetings are never exposed) and race-safe (only the newest request writes state).
 */
export function useMeetings(clubId: string | null) {
  const [stored, setStored] = useState<{ clubId: string; meetings: Meeting[] } | null>(null);
  const meetings = stored && stored.clubId === clubId ? stored.meetings : [];
  const [loading, setLoading] = useState(!!clubId);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!clubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data } = await apiFetch<{ data: Meeting[] }>(`/meetings?clubId=${encodeURIComponent(clubId)}`);
      if (id === requestId.current) setStored({ clubId, meetings: data });
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Mutations re-throw ApiError (403 without meetings:write, validation, ...)
  // for the caller to catch and display inline, same as ProfilTab.tsx --
  // never swallowed here.
  const createMeeting = useCallback(
    async (input: MeetingInput) => {
      const { data } = await apiFetch<{ data: Meeting }>(`/meetings?clubId=${clubId}`, { method: 'POST', body: input });
      await refetch();
      return data;
    },
    [clubId, refetch],
  );

  const updateMeeting = useCallback(
    async (meetingId: string, patch: MeetingPatch) => {
      const { data } = await apiFetch<{ data: Meeting }>(`/meetings/${meetingId}?clubId=${clubId}`, { method: 'PATCH', body: patch });
      await refetch();
      return data;
    },
    [clubId, refetch],
  );

  const deleteMeeting = useCallback(
    async (meetingId: string, notify = true) => {
      await apiFetch(withNotifyQuery(`/meetings/${meetingId}?clubId=${clubId}`, notify), { method: 'DELETE' });
      await refetch();
    },
    [clubId, refetch],
  );

  return { meetings, loading, error, refetch, createMeeting, updateMeeting, deleteMeeting };
}
