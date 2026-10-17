import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeClubSlug } from '@/lib/applicationStatus';

// Same convention as activeClubStorage.ts: the club code the person last applied to is public (the club shares it) and
// not a secret, plain AsyncStorage. Only the code is stored, never any answers.
const LAST_APPLY_CLUB_KEY = '_template_better-auth-mobile.last-apply-club-slug';

export async function getStoredApplyClubSlug(): Promise<string | null> {
  try {
    return normalizeClubSlug(await AsyncStorage.getItem(LAST_APPLY_CLUB_KEY));
  } catch {
    return null;
  }
}

export async function setStoredApplyClubSlug(slug: string): Promise<void> {
  const value = normalizeClubSlug(slug);
  if (!value) return;
  try {
    await AsyncStorage.setItem(LAST_APPLY_CLUB_KEY, value);
  } catch {
    // a convenience only; losing it just means the code is typed again
  }
}
