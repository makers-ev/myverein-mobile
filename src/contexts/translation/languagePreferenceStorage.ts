import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupportedLanguage, type Language } from './supportedLanguages';

// Same tool and key-prefix convention as tosAcceptanceStorage.ts -- a
// language choice is not a secret, AsyncStorage is enough, no keychain
// round-trip needed for a plain UI preference.
const LANGUAGE_KEY = '_template_better-auth-mobile.language';

export async function getStoredLanguage(): Promise<Language | null> {
  const value = await AsyncStorage.getItem(LANGUAGE_KEY);
  return isSupportedLanguage(value) ? value : null;
}

export async function setStoredLanguage(language: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}
