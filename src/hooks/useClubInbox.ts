import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';

/**
 * One row of `GET /club-inbox` (Wave 9 B7). `id` is the *delivery* id -- it is what
 * `POST /club-inbox/:id/read` expects. `kind: 'system'` rows are club system messages
 * (e.g. event changes); `category`/`ctaLabel`/`ctaUrl` are reserved for the later
 * push/deep-link work (M2/M3) and are not acted upon yet.
 */
export interface InboxMessage {
  id: string;
  kind: 'announcement' | 'system';
  announcementId: string | null;
  title: string;
  body: string;
  urgent: boolean;
  category: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  pinned: boolean;
  authorName: string | null;
  sentAt: string | null;
  readAt: string | null;
}

const INBOX_PAGE_SIZE = 100;

// Tiny in-process pub/sub so that reading a message refreshes the Navbar badge at once
// instead of waiting for the next poll. Carries no payload -- never message content.
const listeners = new Set<() => void>();
function notifyInboxChanged() {
  listeners.forEach((listener) => listener());
}

/**
 * Message list for one club: pinned first, then newest (server order is kept). Same
 * fetch-shaped pattern as `useMeetings`: data is stored together with the club it was
 * loaded for and only the newest request may write, so a slow answer for another club
 * (or an older pull-to-refresh) can never overwrite newer state. Message content is
 * never logged.
 */
export function useClubInbox(clubId: string | null) {
  const { isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!clubId;
  const [stored, setStored] = useState<{ clubId: string; messages: InboxMessage[] } | null>(null);
  const messages = stored && stored.clubId === clubId ? stored.messages : [];
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  /** Resolves with the fresh list, or `null` when the load failed or was superseded by a newer one. */
  const refetch = useCallback(async (): Promise<InboxMessage[] | null> => {
    const id = ++requestId.current;
    if (!enabled || !clubId) {
      setStored(null);
      setError(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ clubId, pageSize: String(INBOX_PAGE_SIZE) });
      const { data } = await apiFetch<{ data: InboxMessage[] }>(`/club-inbox?${params.toString()}`);
      if (id !== requestId.current) return null;
      setStored({ clubId, messages: data });
      setError(null);
      return data;
    } catch (err) {
      // Keep the previous list on a failed reload; the screen shows the error only when it has nothing to show.
      if (id === requestId.current) setError(err);
      return null;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [enabled, clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Marks one message read (idempotent on the server); optimistic, rolled back by a refetch on failure. */
  const markRead = useCallback(
    async (messageId: string) => {
      if (!clubId) return;
      const readAt = new Date().toISOString();
      setStored((prev) =>
        prev && prev.clubId === clubId
          ? { ...prev, messages: prev.messages.map((m) => (m.id === messageId && !m.readAt ? { ...m, readAt } : m)) }
          : prev,
      );
      try {
        await apiFetch(`/club-inbox/${encodeURIComponent(messageId)}/read?clubId=${encodeURIComponent(clubId)}`, { method: 'POST' });
        notifyInboxChanged();
      } catch {
        void refetch();
      }
    },
    [clubId, refetch],
  );

  return { messages, loading, error, refetch, markRead };
}

const UNREAD_COUNT_POLL_MS = 30_000;

/**
 * Backs the Navbar's "Mitteilungen" badge. Polls like `useUnreadNotificationCount`
 * (ADR-006: polling, no realtime in v1), additionally refreshes when the app returns to
 * the foreground and right after a message was marked read. Only the newest request may
 * write; a club switch resets the count immediately. Failures keep the last count.
 */
export function useUnreadCount(clubId: string | null) {
  const { isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!clubId;
  const [stored, setStored] = useState<{ clubId: string; count: number } | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!enabled || !clubId) return;
    try {
      const { data } = await apiFetch<{ data: { count: number } }>(`/club-inbox/unread-count?clubId=${encodeURIComponent(clubId)}`);
      if (id === requestId.current) setStored({ clubId, count: data.count });
    } catch {
      // Badge is best effort; the next poll retries.
    }
  }, [enabled, clubId]);

  useEffect(() => {
    if (!enabled) {
      requestId.current++;
      return;
    }
    void refresh();
    const interval = setInterval(() => void refresh(), UNREAD_COUNT_POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    listeners.add(refresh);
    return () => {
      clearInterval(interval);
      appState.remove();
      listeners.delete(refresh);
    };
  }, [enabled, refresh]);

  return enabled && stored && stored.clubId === clubId ? stored.count : 0;
}
