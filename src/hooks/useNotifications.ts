import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';

export interface NotificationItem {
  id: string;
  kind: 'system' | 'admin';
  translationKey: string | null;
  paramsJson: Record<string, unknown> | null;
  translations: Record<string, { title: string; body: string }> | null;
  deletable: boolean;
  read: boolean;
  createdAt: string;
}

/** Fetch-shaped hook (see README.md's "Adding a new API request") for one filtered list. */
export function useNotifications(filter: 'unread' | 'read') {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: NotificationItem[] }>(`/notifications?filter=${filter}`);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, filter]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { notifications, loading, refetch };
}

const UNREAD_COUNT_POLL_MS = 30_000;

/** Backs the Navbar's bell badge -- polls on an interval, ADR-006: polling, no realtime in v1. */
export function useUnreadNotificationCount() {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void apiFetch<{ data: { count: number } }>('/notifications/unread-count').then(({ data }) => {
        if (!cancelled) setCount(data.count);
      });
    };
    refresh();
    const interval = setInterval(refresh, UNREAD_COUNT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  return count;
}

/** Mutation-shaped hook (see README.md's "Adding a new API request") -- caller decides what to do with the result, e.g. calling `refetch()` from `useNotifications`. */
export function useNotificationMutations() {
  const markRead = useCallback((id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' }), []);
  const markUnread = useCallback((id: string) => apiFetch<void>(`/notifications/${id}/unread`, { method: 'POST' }), []);
  const deleteNotification = useCallback((id: string) => apiFetch<void>(`/notifications/${id}`, { method: 'DELETE' }), []);

  return { markRead, markUnread, deleteNotification };
}
