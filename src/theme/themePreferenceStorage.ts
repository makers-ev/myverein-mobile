import AsyncStorage from '@react-native-async-storage/async-storage';

// Same convention as tosAcceptanceStorage.ts. Only 'dark'/'light' are ever
// stored -- unset means "no explicit choice yet", in which case app.json's
// userInterfaceStyle: "automatic" (OS default) applies, not a third stored
// value.
const THEME_KEY = '_template_better-auth-mobile.theme';

export async function getStoredTheme(): Promise<'dark' | 'light' | null> {
  const value = await AsyncStorage.getItem(THEME_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export async function setStoredTheme(theme: 'dark' | 'light'): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, theme);
}
