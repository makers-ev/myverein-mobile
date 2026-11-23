import React, { type ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';

interface Props {
  children: ReactNode;
  /** `L` 34/40 (screen title, flow header), `M` 28/34 (hero lines, membership card name). */
  size?: 'L' | 'M';
  /** Colour classes; defaults to strong text. Pass `text-primary-foreground ...` on a primary fill. */
  className?: string;
  /** Screen titles are headers for screen readers; set false for a hero line inside a card. */
  header?: boolean;
  numberOfLines?: number;
  style?: TextStyle;
}

/** System font (iOS SF / Helvetica Neue, Android Roboto), bold with slightly tightened tracking like iOS large titles. */
const SIZES = {
  L: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.7 },
  M: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
};

/**
 * Display title (`Title/L`, `Title/M`): the system font at 700 with a slightly negative letter spacing. Only for screen
 * titles and hero moments -- never for body text, buttons or list rows. Wraps to two lines at large text sizes instead
 * of truncating.
 */
export default function Title({ children, size = 'L', className = 'text-foreground dark:text-foreground-dark', header = true, numberOfLines, style }: Props) {
  return (
    <Text accessibilityRole={header ? 'header' : undefined} numberOfLines={numberOfLines} className={className} style={[SIZES[size], style]}>
      {children}
    </Text>
  );
}
