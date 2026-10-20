import { secureStore } from '@/lib/appStorage';
import { readWithMigration, removeItem, writeItem } from '@/lib/storageMigration';

// Persists the local App Lock PIN. Uses the same expo-secure-store backend
// already used for the Better Auth session (see src/auth/auth-client.ts) so
// the PIN survives app restarts and lives in the OS keychain/keystore
// rather than plain component state.
const APP_LOCK_PIN = 'app-lock-pin';

export async function getAppLockPin(): Promise<string | null> {
  return readWithMigration(secureStore, APP_LOCK_PIN);
}

export async function setAppLockPin(pin: string): Promise<void> {
  await writeItem(secureStore, APP_LOCK_PIN, pin);
}

export async function clearAppLockPin(): Promise<void> {
  await removeItem(secureStore, APP_LOCK_PIN);
}
