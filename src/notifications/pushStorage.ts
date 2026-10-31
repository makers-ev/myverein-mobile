import { asyncStore, secureStore } from '@/lib/appStorage';
import { readWithMigration, removeItem, writeItem } from '@/lib/storageMigration';
import {
  parsePendingUnregister,
  parseStoredRegistration,
  type PendingUnregister,
  type StoredRegistration,
} from './pushLogic';

// The token + account of this install's last backend registration. Kept in the keychain/keystore
// (not a secret credential, but it ties a device to an account) so logout after a relaunch can
// still unregister it. Never logged.
const REGISTRATION = 'push-registration';
// Token only: its `DELETE /push-tokens/:token` failed (offline logout, session lost); retried while signed in.
const PENDING_UNREGISTER = 'push-pending-unregister';
// UI flag per account: the one-time "enable push?" hint on Mitteilungen was dismissed.
const PROMPT_DISMISSED = 'push-prompt-dismissed';

export async function getStoredRegistration(): Promise<StoredRegistration | null> {
  return parseStoredRegistration(await readWithMigration(secureStore, REGISTRATION));
}

export async function setStoredRegistration(value: StoredRegistration): Promise<void> {
  await writeItem(secureStore, REGISTRATION, JSON.stringify(value));
}

export async function clearStoredRegistration(): Promise<void> {
  await removeItem(secureStore, REGISTRATION);
}

export async function getPendingUnregister(): Promise<PendingUnregister | null> {
  return parsePendingUnregister(await readWithMigration(secureStore, PENDING_UNREGISTER));
}

export async function setPendingUnregister(value: PendingUnregister): Promise<void> {
  await writeItem(secureStore, PENDING_UNREGISTER, JSON.stringify(value));
}

export async function clearPendingUnregister(): Promise<void> {
  await removeItem(secureStore, PENDING_UNREGISTER);
}

const promptKey = (userId: string) => `${PROMPT_DISMISSED}.${userId.replace(/[^A-Za-z0-9_-]/g, '_')}`;

export async function isPushPromptDismissed(userId: string): Promise<boolean> {
  return (await readWithMigration(asyncStore, promptKey(userId))) === '1';
}

export async function setPushPromptDismissed(userId: string): Promise<void> {
  await writeItem(asyncStore, promptKey(userId), '1');
}
