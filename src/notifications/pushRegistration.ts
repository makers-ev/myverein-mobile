import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { apiFetch } from '@/lib/api';
import { needsRegistration } from './pushLogic';
import { getPushToken } from './pushNative';
import { clearStoredRegistration, getStoredRegistration, setStoredRegistration } from './pushStorage';

/**
 * Registers this device's Expo push token for the signed-in account (`POST /push-tokens`; the
 * backend binds it to the caller and re-assigns it on an account switch). Skips the request when
 * the same token was registered for the same account within the last day. Returns false on any
 * failure (retried on the next foreground); nothing about the token is logged.
 */
export async function registerPushToken(userId: string, now = Date.now()): Promise<boolean> {
  try {
    const token = await getPushToken();
    if (!token) return false;
    const stored = await getStoredRegistration();
    if (!needsRegistration(stored, token, userId, now)) return true;
    await apiFetch('/push-tokens', {
      method: 'POST',
      body: {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: Constants.expoConfig?.version ?? undefined,
      },
    });
    await setStoredRegistration({ token, userId, at: now });
    return true;
  } catch {
    return false;
  }
}

const UNREGISTER_TIMEOUT_MS = 4000;

/**
 * Logout: removes this device's token from the account (`DELETE /push-tokens/:token`) while the
 * session is still valid. Best effort with a short timeout so a bad network never blocks the
 * logout; the local record is always cleared. A token that stays behind is disabled by the
 * backend on the next `DeviceNotRegistered` receipt or re-assigned on the next login.
 */
export async function unregisterPushToken(): Promise<void> {
  let stored;
  try {
    stored = await getStoredRegistration();
  } catch {
    return;
  }
  if (!stored) return;
  try {
    await Promise.race([
      apiFetch(`/push-tokens/${encodeURIComponent(stored.token)}`, { method: 'DELETE' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), UNREGISTER_TIMEOUT_MS)),
    ]);
  } catch {
    // Best effort, see above.
  }
  try {
    await clearStoredRegistration();
  } catch {
    // Nothing else to do.
  }
}
