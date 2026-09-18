import AsyncStorage from '@react-native-async-storage/async-storage';

// Same tool/convention as legal/tosAcceptanceStorage.ts -- a plain "have they seen this" UI flag, not a secret.
const INTRO_SEEN_KEY = '_template_better-auth-mobile.intro-seen';

export async function hasSeenIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === '1';
}

export async function setIntroSeen(seen: boolean): Promise<void> {
  if (seen) await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
  else await AsyncStorage.removeItem(INTRO_SEEN_KEY);
}
