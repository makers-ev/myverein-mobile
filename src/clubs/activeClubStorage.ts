import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, removeItem, writeItem } from '@/lib/storageMigration';

// Same convention as tosAcceptanceStorage.ts: a club choice is not a secret,
// plain AsyncStorage. Only the club id is stored; membership data is always
// re-fetched from the backend.
const ACTIVE_CLUB_KEY = 'active-club-id';

export async function getStoredActiveClubId(): Promise<string | null> {
  return readWithMigration(asyncStore, ACTIVE_CLUB_KEY);
}

export async function setStoredActiveClubId(clubId: string): Promise<void> {
  await writeItem(asyncStore, ACTIVE_CLUB_KEY, clubId);
}

export async function clearStoredActiveClubId(): Promise<void> {
  await removeItem(asyncStore, ACTIVE_CLUB_KEY);
}
