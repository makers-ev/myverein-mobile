import { useColorScheme } from 'nativewind';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';

import { usePalette } from './PaletteProvider';
import { FIXED_COLORS } from './palettes';

/**
 * Fixed regardless of the chosen palette (ADR-008) -- danger/success/warning
 * shouldn't shift with the accent color. Everything else comes from the
 * active palette via `usePalette()` (see PaletteProvider.tsx / palettes.ts),
 * which also drives the matching `bg-card dark:bg-card-dark`-style
 * classNames through NativeWind CSS variables. `warning` added for
 * MyVerein's overdue-loan/maintenance-due/open-Beitrag states.
 */

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  success: string;
  warning: string;
};

/** Resolves the current color-scheme's + palette's token set for use in JS-prop colors. */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  const { tokens } = usePalette();
  const isDark = colorScheme === 'dark';
  return { ...tokens[isDark ? 'dark' : 'light'], ...FIXED_COLORS[isDark ? 'dark' : 'light'] };
}

/** `NavigationContainer`'s `theme` prop -- its own default falls back to a hardcoded white `colors.background`. */
export function useNavigationTheme(): NavigationTheme {
  const { colorScheme } = useColorScheme();
  const { tokens } = usePalette();
  const isDark = colorScheme === 'dark';
  const themeColors = tokens[isDark ? 'dark' : 'light'];
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      background: themeColors.background,
      card: themeColors.card,
      primary: themeColors.primary,
      text: themeColors.foreground,
      border: themeColors.border,
    },
  };
}
