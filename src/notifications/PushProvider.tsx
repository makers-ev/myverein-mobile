import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import type { NotificationResponse } from 'expo-notifications';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { nextRegisteringStatus, parsePushPayload, statusFromPermission, type PushStatus } from './pushLogic';
import {
  ensureAndroidChannels,
  getNotifications,
  installForegroundHandler,
  pushEnvironmentLimit,
  readPermission,
  requestPermission,
} from './pushNative';
import { flushPendingUnregister, markPendingUnregister, registerPushToken, resumePushRegistration } from './pushRegistration';
import { isPushPromptDismissed, setPushPromptDismissed } from './pushStorage';
import { setIncomingPushTarget } from './pushTargetStore';

interface PushContextValue {
  status: PushStatus;
  /** True while the permission dialog or the registration request is running. */
  busy: boolean;
  /** Asks for the system permission (call only after the user chose to) and registers the token. */
  enable: () => Promise<void>;
  /** Retries the registration after an `error` status. */
  retry: () => Promise<void>;
  /** Opens the system settings of the app (for a denied permission). */
  openSystemSettings: () => void;
  /** The one-time hint on Mitteilungen: shown only until dismissed or push is set up. */
  promptVisible: boolean;
  dismissPrompt: () => void;
}

const PushContext = createContext<PushContextValue | null>(null);

let lastHandledResponseId: string | null = null;

/**
 * Push registration and tap handling (Wave 9 M2/M3). Never asks for permission by itself: the
 * system dialog is only triggered by `enable()` from the notification settings or the one-time
 * hint on Mitteilungen. Once the permission is granted the token is (re)registered for the
 * signed-in account on start, on account change and whenever the app returns to the foreground.
 * Expo Go, simulators, web and builds without an EAS project id are a graceful no-op.
 */
export function PushProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const userId = isAuthenticated ? (user?.id ?? null) : null;
  const limit = useMemo(() => pushEnvironmentLimit(), []);
  const [status, setStatus] = useState<PushStatus>(limit ?? 'undetermined');
  const [busy, setBusy] = useState(false);
  // The stored "hint dismissed" flag per account; the hint stays hidden until it was read for the current account.
  const [dismissedFlag, setDismissedFlag] = useState<{ userId: string; value: boolean } | null>(null);
  const dismissed = !userId || dismissedFlag?.userId !== userId || dismissedFlag.value;
  const userIdRef = useRef(userId);
  const syncSeq = useRef(0);
  const previousUserId = useRef<string | null>(userId);
  useEffect(() => {
    userIdRef.current = userId;
    // Signed in again (or as someone else): registrations are allowed again after a logout.
    if (userId) resumePushRegistration();
    // The session ended without our own logout (expired / revoked elsewhere): queue the token for removal.
    if (!userId && previousUserId.current) void markPendingUnregister();
    previousUserId.current = userId;
  }, [userId]);

  // Reads the current permission; registers when granted. Never prompts.
  const sync = useCallback(async () => {
    if (limit) return;
    // Only the newest sync may write the status; the account must also still be the one it started for.
    const seq = ++syncSeq.current;
    const id = userIdRef.current;
    const stale = () => seq !== syncSeq.current || userIdRef.current !== id;
    try {
      const permission = await readPermission();
      if (stale()) return;
      if (permission !== 'granted' || !id) {
        setStatus(statusFromPermission(permission, false, false));
        return;
      }
      // Routine re-syncs of an already registered device keep showing 'registered' instead of flashing a spinner.
      setStatus(nextRegisteringStatus);
      await flushPendingUnregister();
      if (stale()) return;
      const ok = await registerPushToken(id, () => userIdRef.current);
      if (stale()) return;
      setStatus(statusFromPermission('granted', ok, !ok));
    } catch {
      if (!stale()) setStatus('error');
    }
  }, [limit]);

  useEffect(() => {
    if (limit) return;
    installForegroundHandler();
    // Android 13+ needs the channels before the permission dialog; `urgent` is used by the backend.
    void ensureAndroidChannels(t).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    isPushPromptDismissed(userId)
      .then((value) => !cancelled && setDismissedFlag({ userId, value }))
      .catch(() => !cancelled && setDismissedFlag({ userId, value: false }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    void sync();
  }, [sync, userId]);

  useEffect(() => {
    if (limit) return;
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    const N = getNotifications();
    const tokenSub = N?.addPushTokenListener(() => void sync());
    return () => {
      appState.remove();
      tokenSub?.remove();
    };
  }, [limit, sync]);

  // Taps (M3): cold start via the last response, background/foreground via the listener.
  // Only ids from the payload are used; nothing of it is logged.
  useEffect(() => {
    const N = getNotifications();
    if (!N) return;
    const handle = (response: NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (id === lastHandledResponseId) return;
      lastHandledResponseId = id;
      N.clearLastNotificationResponse();
      const target = parsePushPayload(response.notification.request.content.data);
      if (target) setIncomingPushTarget(target);
    };
    const last = N.getLastNotificationResponse();
    if (last) handle(last);
    const sub = N.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  const enable = useCallback(async () => {
    if (limit) return;
    setBusy(true);
    try {
      await requestPermission();
      await sync();
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }, [limit, sync]);

  const retry = useCallback(async () => {
    if (limit) return;
    setBusy(true);
    try {
      await sync();
    } finally {
      setBusy(false);
    }
  }, [limit, sync]);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  const dismissPrompt = useCallback(() => {
    if (!userId) return;
    setDismissedFlag({ userId, value: true });
    void setPushPromptDismissed(userId).catch(() => undefined);
  }, [userId]);

  const value = useMemo<PushContextValue>(
    () => ({
      status,
      busy,
      enable,
      retry,
      openSystemSettings,
      promptVisible: !dismissed && status === 'undetermined' && !!userId,
      dismissPrompt,
    }),
    [status, busy, enable, retry, openSystemSettings, dismissed, userId, dismissPrompt],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): PushContextValue {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error('usePush must be used inside PushProvider');
  return ctx;
}
