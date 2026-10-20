import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, removeItem, writeItem } from '@/lib/storageMigration';

// Same tool/convention as legal/tosAcceptanceStorage.ts -- a plain "have they seen this" UI flag, not a secret.
const INTRO_SEEN_KEY = 'intro-seen';

export async function hasSeenIntro(): Promise<boolean> {
  return (await readWithMigration(asyncStore, INTRO_SEEN_KEY)) === '1';
}

export async function setIntroSeen(seen: boolean): Promise<void> {
  if (seen) await writeItem(asyncStore, INTRO_SEEN_KEY, '1');
  else await removeItem(asyncStore, INTRO_SEEN_KEY);
}
