import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, writeItem } from '@/lib/storageMigration';

// Same convention as tosAcceptanceStorage.ts. Only 'dark'/'light' are ever
// stored -- unset means "no explicit choice yet", in which case app.json's
// userInterfaceStyle: "automatic" (OS default) applies, not a third stored
// value.
const THEME_KEY = 'theme';

export async function getStoredTheme(): Promise<'dark' | 'light' | null> {
  const value = await readWithMigration(asyncStore, THEME_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export async function setStoredTheme(theme: 'dark' | 'light'): Promise<void> {
  await writeItem(asyncStore, THEME_KEY, theme);
}
