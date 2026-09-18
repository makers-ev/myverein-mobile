import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

export type MeetingStatus = 'terminfindung' | 'geplant' | 'abgehalten' | 'protokolliert';

export interface Meeting {
  id: string;
  clubId: string;
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

/** `POST /meetings` body -- `type` is free-text (Freitext-Beispiele), not a fixed enum, see meetings.ts schema. */
export interface MeetingInput {
  type: string;
  title: string;
  scheduledAt?: string;
}

/** `PATCH /meetings/:id` body. */
export interface MeetingPatch {
  type?: string;
  title?: string;
  scheduledAt?: string | null;
  agenda?: string | null;
  minutes?: string | null;
  status?: MeetingStatus;
}

/** Fetch-shaped hook for `GET /meetings?clubId=`, see README.md's "Adding a new API request". */
export function useMeetings(clubId: string | null) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: Meeting[] }>(`/meetings?clubId=${clubId}`);
      setMeetings(data);
    } finally {
      setLoading(false);
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
    async (meetingId: string) => {
      await apiFetch(`/meetings/${meetingId}?clubId=${clubId}`, { method: 'DELETE' });
      await refetch();
    },
    [clubId, refetch],
  );

  return { meetings, loading, refetch, createMeeting, updateMeeting, deleteMeeting };
}
