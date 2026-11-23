import { useMemo } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';

import { useThemeColors } from './colors';
import { contrastRatio } from './contrast';

/**
 * Elevation instead of hairlines (Apple style). Light mode: a soft, warm, low shadow on the card surface (iOS `shadow*`,
 * Android a small `elevation`). Dark mode: NO shadow -- the card is simply a lighter surface step than the canvas (see
 * `palettes.ts`), and nothing gets a hard border. Control borders (inputs, outline buttons) are not elevation and keep
 * `borderControl` for the 3:1 contrast.
 */
export type Elevation = 'card' | 'hero' | 'bar';

const NONE: ViewStyle = { shadowOpacity: 0, elevation: 0 };

/** Shadow style for a surface. `hero` is tinted with the primary colour (a soft coloured glow under the hero card). */
export function useElevation(level: Elevation = 'card'): ViewStyle {
  const { colorScheme } = useColorScheme();
  const colors = useThemeColors();
  const dark = colorScheme === 'dark';
  const { primary, card, background, divider } = colors;
  return useMemo(() => {
    if (dark) return level === 'hero' ? hero(primary, 0.35) : NONE;
    if (level === 'hero') return hero(primary, 0.28);
    if (level === 'bar') return { shadowColor: '#1a160c', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 8 };
    const shadow: ViewStyle = { shadowColor: '#1a160c', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: Platform.OS === 'android' ? 2 : 0 };
    // Palettes whose light card equals the canvas (ink-navy, ocean, forest, sunset, derived ones) cannot rely on the
    // shadow alone: add a fine divider edge there. Vereinsblau (warm canvas, white card) stays borderless.
    return contrastRatio(card, background) < 1.05 ? { ...shadow, borderWidth: 1, borderColor: divider } : shadow;
  }, [dark, level, primary, card, background, divider]);
}

function hero(color: string, opacity: number): ViewStyle {
  return { shadowColor: color, shadowOpacity: opacity, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 };
}
