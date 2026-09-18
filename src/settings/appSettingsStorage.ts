import AsyncStorage from '@react-native-async-storage/async-storage';

// Same convention as tosAcceptanceStorage.ts. Both toggles default to
// visible (`true`) until the user explicitly turns them off -- matches
// SettingsScreen.tsx's previous hardcoded `setShowTopbarTitles(true)`/
// `setShowNavbarTitles(true)` stub behavior, so a fresh install looks the
// same as before this was wired to storage.
const SHOW_TOPBAR_TITLES_KEY = '_template_better-auth-mobile.show-topbar-titles';
const SHOW_NAVBAR_TITLES_KEY = '_template_better-auth-mobile.show-navbar-titles';

export async function getShowTopbarTitles(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SHOW_TOPBAR_TITLES_KEY);
  return value !== '0';
}

export async function setShowTopbarTitles(show: boolean): Promise<void> {
  await AsyncStorage.setItem(SHOW_TOPBAR_TITLES_KEY, show ? '1' : '0');
}

export async function getShowNavbarTitles(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SHOW_NAVBAR_TITLES_KEY);
  return value !== '0';
}

export async function setShowNavbarTitles(show: boolean): Promise<void> {
  await AsyncStorage.setItem(SHOW_NAVBAR_TITLES_KEY, show ? '1' : '0');
}
