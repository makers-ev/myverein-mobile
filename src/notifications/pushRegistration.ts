import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { apiFetch } from '@/lib/api';
import { withTimeout } from '@/lib/withTimeout';
import { isRegistrationCurrent, isRetryableUnregisterFailure, needsRegistration } from './pushLogic';
import { getPushToken } from './pushNative';
import {
  clearPendingUnregister,
  clearStoredRegistration,
  getPendingUnregister,
  getStoredRegistration,
  setPendingUnregister,
  setStoredRegistration,
} from './pushStorage';

// Logout generation: bumped whenever the account's token is being unregistered or the session was
// lost, so a registration that started earlier can neither POST nor write its record afterwards.
let epoch = 0;
// True from the start of a logout/account deletion until `resumePushRegistration()`.
let unregistering = false;

/** Re-allows registrations (after the sign-out / account deletion finished or failed, or on a new login). */
export function resumePushRegistration(): void {
  unregistering = false;
}

/**
 * Registers this device's Expo push token for the signed-in account (`POST /push-tokens`; the
 * backend binds it to the caller and re-assigns it on an account switch). Skips the request when
 * the same token was registered for the same account within the last day. `getCurrentUserId` is
 * checked before the request and before the record is written: if a logout / account switch
 * happened meanwhile nothing is stored and a token that already reached the backend is queued for
 * removal. Returns false on any failure (retried on the next foreground); nothing about the token
 * is logged.
 */
export async function registerPushToken(userId: string, getCurrentUserId: () => string | null, now = Date.now()): Promise<boolean> {
  const started = { epoch, userId };
  const current = () => isRegistrationCurrent(started, { epoch, userId: getCurrentUserId(), unregistering });
  try {
    const token = await getPushToken();
    if (!token || !current()) return false;
    const stored = await getStoredRegistration();
    if (!needsRegistration(stored, token, userId, now)) return true;
    if (!current()) return false;
    await apiFetch('/push-tokens', {
      method: 'POST',
      body: {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: Constants.expoConfig?.version ?? undefined,
      },
    });
    if (!current()) {
      // Logout won the race but the backend now holds the token: remove it as soon as possible.
      await setPendingUnregister({ token }).catch(() => undefined);
      return false;
    }
    await setStoredRegistration({ token, userId, at: now });
    // A fresh registration supersedes an earlier failed removal of the same token.
    const pending = await getPendingUnregister();
    if (pending?.token === token) await clearPendingUnregister();
    return true;
  } catch {
    return false;
  }
}

const UNREGISTER_TIMEOUT_MS = 4000;

async function deleteToken(token: string): Promise<'done' | 'retry'> {
  try {
    await withTimeout(apiFetch(`/push-tokens/${encodeURIComponent(token)}`, { method: 'DELETE' }), UNREGISTER_TIMEOUT_MS);
    return 'done';
  } catch (err) {
    return isRetryableUnregisterFailure((err as { status?: number }).status) ? 'retry' : 'done';
  }
}

/**
 * Logout / account deletion: removes this device's token from the account
 * (`DELETE /push-tokens/:token`) while the session is still valid. Time-boxed so a bad network
 * never blocks the logout. Blocks new registrations until `resumePushRegistration()`. When the
 * removal fails retryably the token is kept as a "pending unregister" (token only) and retried
 * while signed in (`flushPendingUnregister`); the registration record is always cleared.
 */
export async function unregisterPushToken(): Promise<void> {
  epoch += 1;
  unregistering = true;
  let stored;
  try {
    stored = await getStoredRegistration();
  } catch {
    return;
  }
  if (!stored) return;
  if ((await deleteToken(stored.token)) === 'retry') {
    await setPendingUnregister({ token: stored.token }).catch(() => undefined);
  }
  await clearStoredRegistration().catch(() => undefined);
}

/**
 * The session ended without our logout (expiry, revocation on another device): the token cannot be
 * deleted any more, so it is queued for removal and the registration record is dropped.
 */
export async function markPendingUnregister(): Promise<void> {
  epoch += 1;
  try {
    const stored = await getStoredRegistration();
    if (!stored) return;
    await setPendingUnregister({ token: stored.token });
    await clearStoredRegistration();
  } catch {
    // Best effort; the backend also disables tokens on DeviceNotRegistered receipts.
  }
}

/** Retries a queued removal (needs a session): on start, on foreground and after login. */
export async function flushPendingUnregister(): Promise<void> {
  try {
    const pending = await getPendingUnregister();
    if (!pending) return;
    const stored = await getStoredRegistration();
    if (stored?.token === pending.token) {
      // The device registered the same token again since: it must not be removed.
      await clearPendingUnregister();
      return;
    }
    if ((await deleteToken(pending.token)) === 'done') await clearPendingUnregister();
  } catch {
    // Retried on the next trigger.
  }
}
