import AsyncStorage from '@react-native-async-storage/async-storage';

// Same convention as tosAcceptanceStorage.ts: a club choice is not a secret,
// plain AsyncStorage. Only the club id is stored; membership data is always
// re-fetched from the backend.
const ACTIVE_CLUB_KEY = '_template_better-auth-mobile.active-club-id';

export async function getStoredActiveClubId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_CLUB_KEY);
}

export async function setStoredActiveClubId(clubId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_CLUB_KEY, clubId);
}

export async function clearStoredActiveClubId(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_CLUB_KEY);
}
