import * as SecureStore from 'expo-secure-store';

// Persists the local App Lock PIN. Uses the same expo-secure-store backend
// already used for the Better Auth session (see src/auth/auth-client.ts) so
// the PIN survives app restarts and lives in the OS keychain/keystore
// rather than plain component state.
const APP_LOCK_PIN_KEY = '_template_better-auth-mobile.app-lock-pin';

export async function getAppLockPin(): Promise<string | null> {
  return SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
}

export async function setAppLockPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, pin);
}

export async function clearAppLockPin(): Promise<void> {
  await SecureStore.deleteItemAsync(APP_LOCK_PIN_KEY);
}
