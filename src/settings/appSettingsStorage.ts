import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, writeItem } from '@/lib/storageMigration';

// Same convention as tosAcceptanceStorage.ts. Both toggles default to
// visible (`true`) until the user explicitly turns them off -- matches
// SettingsScreen.tsx's previous hardcoded `setShowTopbarTitles(true)`/
// `setShowNavbarTitles(true)` stub behavior, so a fresh install looks the
// same as before this was wired to storage.
const SHOW_TOPBAR_TITLES_KEY = 'show-topbar-titles';
const SHOW_NAVBAR_TITLES_KEY = 'show-navbar-titles';

export async function getShowTopbarTitles(): Promise<boolean> {
  const value = await readWithMigration(asyncStore, SHOW_TOPBAR_TITLES_KEY);
  return value !== '0';
}

export async function setShowTopbarTitles(show: boolean): Promise<void> {
  await writeItem(asyncStore, SHOW_TOPBAR_TITLES_KEY, show ? '1' : '0');
}

export async function getShowNavbarTitles(): Promise<boolean> {
  const value = await readWithMigration(asyncStore, SHOW_NAVBAR_TITLES_KEY);
  return value !== '0';
}

export async function setShowNavbarTitles(show: boolean): Promise<void> {
  await writeItem(asyncStore, SHOW_NAVBAR_TITLES_KEY, show ? '1' : '0');
}
