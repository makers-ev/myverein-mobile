import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, writeItem } from '@/lib/storageMigration';

import { isSupportedLanguage, type Language } from './supportedLanguages';

// Same tool and key-prefix convention as tosAcceptanceStorage.ts -- a
// language choice is not a secret, AsyncStorage is enough, no keychain
// round-trip needed for a plain UI preference.
const LANGUAGE_KEY = 'language';

export async function getStoredLanguage(): Promise<Language | null> {
  const value = await readWithMigration(asyncStore, LANGUAGE_KEY);
  return isSupportedLanguage(value) ? value : null;
}

export async function setStoredLanguage(language: Language): Promise<void> {
  await writeItem(asyncStore, LANGUAGE_KEY, language);
}
