import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, writeItem } from '@/lib/storageMigration';

// Whether has been seen, not a secret -- AsyncStorage (already a
// dependency, unlike expo-secure-store this doesn't round-trip through the
// OS keychain for a plain UI flag) is enough here, same tool mycollection-app
// uses for the identical first-launch check.
const TOS_ACCEPTED_KEY = 'tos-accepted';

export async function hasAcceptedTos(): Promise<boolean> {
  return (await readWithMigration(asyncStore, TOS_ACCEPTED_KEY)) === '1';
}

export async function setTosAccepted(): Promise<void> {
  await writeItem(asyncStore, TOS_ACCEPTED_KEY, '1');
}
