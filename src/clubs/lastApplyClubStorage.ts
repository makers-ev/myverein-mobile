import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, writeItem } from '@/lib/storageMigration';

import { normalizeClubSlug } from '@/lib/applicationStatus';

// Same convention as activeClubStorage.ts: the club code the person last applied to is public (the club shares it) and
// not a secret, plain AsyncStorage. Only the code is stored, never any answers.
const LAST_APPLY_CLUB_KEY = 'last-apply-club-slug';

export async function getStoredApplyClubSlug(): Promise<string | null> {
  try {
    return normalizeClubSlug(await readWithMigration(asyncStore, LAST_APPLY_CLUB_KEY));
  } catch {
    return null;
  }
}

export async function setStoredApplyClubSlug(slug: string): Promise<void> {
  const value = normalizeClubSlug(slug);
  if (!value) return;
  try {
    await writeItem(asyncStore, LAST_APPLY_CLUB_KEY, value);
  } catch {
    // a convenience only; losing it just means the code is typed again
  }
}
