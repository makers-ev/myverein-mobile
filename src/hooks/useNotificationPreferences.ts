import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { apiFetch } from '@/lib/api';

export type PreferenceCategory = 'announcements' | 'events' | 'reminders';
export type PreferenceChannel = 'in_app' | 'email' | 'push';

export interface NotificationPreferences {
  categories: { category: PreferenceCategory; channels: { channel: PreferenceChannel; enabled: boolean; switchable: boolean }[] }[];
  mandatory: { key: 'account_security' | 'own_decisions' | 'invitation_deadlines'; switchable: false }[];
}

/**
 * `GET`/`PUT /notification-preferences` (user level, not per club). Writes are optimistic
 * per toggle and rolled back to the server state on failure; only the newest request may
 * write state. The `push` channel is listed by the backend but delivered only once push
 * registration exists (M2) -- the Settings section says so.
 */
export function useNotificationPreferences() {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    if (!isAuthenticated) {
      setPreferences(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: NotificationPreferences }>('/notification-preferences');
      if (id !== requestId.current) return;
      setPreferences(data);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Returns true on success; on failure the server state is reloaded and the caller shows an error. */
  const setEnabled = useCallback(
    async (category: PreferenceCategory, channel: Exclude<PreferenceChannel, 'in_app'>, enabled: boolean) => {
      const id = ++requestId.current;
      setPreferences((prev) =>
        prev
          ? {
              ...prev,
              categories: prev.categories.map((c) =>
                c.category === category ? { ...c, channels: c.channels.map((ch) => (ch.channel === channel ? { ...ch, enabled } : ch)) } : c,
              ),
            }
          : prev,
      );
      try {
        const { data } = await apiFetch<{ data: NotificationPreferences }>('/notification-preferences', {
          method: 'PUT',
          body: { preferences: [{ category, channel, enabled }] },
        });
        if (id === requestId.current) setPreferences(data);
        return true;
      } catch {
        void refetch();
        return false;
      }
    },
    [refetch],
  );

  return { preferences, loading, error, refetch, setEnabled };
}
