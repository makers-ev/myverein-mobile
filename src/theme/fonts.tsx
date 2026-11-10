import React, { createContext, useContext, type ReactNode } from 'react';
import type { TextStyle } from 'react-native';
import { useFonts } from 'expo-font';

/**
 * Display font (design decision D2): Instrument Serif, the website's display face, bundled as a plain TTF asset and
 * loaded at runtime with `expo-font` (works in Expo Go, no native config or config plugin). It is used ONLY for screen
 * titles and hero moments (`Title`, `HeroCard`, the membership card); every other text stays on the system font, which
 * keeps Dynamic Type, Android font scaling and the native look for the dense UI.
 *
 * Safe fallback: the app never waits for the font. Until it is loaded (or if loading fails) `useDisplayFont()` returns
 * `null` and titles render in the system font at weight 600 instead.
 */
export const DISPLAY_FONT_FAMILY = 'InstrumentSerif_400Regular';

const DisplayFontContext = createContext(false);

export function FontProvider({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({
    [DISPLAY_FONT_FAMILY]: require('@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf'),
  });
  return <DisplayFontContext.Provider value={loaded && !error}>{children}</DisplayFontContext.Provider>;
}

/** Style for display text: the serif family when available, otherwise `null` (caller falls back to system 600). */
export function useDisplayFont(): TextStyle | null {
  const ready = useContext(DisplayFontContext);
  // Instrument Serif ships one weight: never ask for bold (Android would fake it).
  return ready ? { fontFamily: DISPLAY_FONT_FAMILY, fontWeight: 'normal' } : null;
}
