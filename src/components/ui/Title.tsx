import React, { type ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';

import { useDisplayFont } from '@/theme/fonts';

interface Props {
  children: ReactNode;
  /** `L` 34/38 (screen title, hero, membership card), `M` 28/32 (inline hero lines). */
  size?: 'L' | 'M';
  /** Colour classes; defaults to strong text. Pass `text-primary-foreground ...` on a primary fill. */
  className?: string;
  /** Screen titles are headers for screen readers; set false for a hero line inside a card. */
  header?: boolean;
  numberOfLines?: number;
  style?: TextStyle;
}

const SIZES = {
  L: { serif: { fontSize: 34, lineHeight: 38 }, fallback: { fontSize: 30, lineHeight: 36, fontWeight: '600' as const } },
  M: { serif: { fontSize: 28, lineHeight: 32 }, fallback: { fontSize: 24, lineHeight: 30, fontWeight: '600' as const } },
};

/**
 * Display title (`Title/L`): Instrument Serif when it is loaded, the system font at 600 otherwise. Only for screen
 * titles and hero moments -- never for body text, buttons or list rows. Wraps to two lines at large text sizes instead
 * of truncating.
 */
export default function Title({ children, size = 'L', className = 'text-foreground dark:text-foreground-dark', header = true, numberOfLines, style }: Props) {
  const serif = useDisplayFont();
  const s = SIZES[size];
  return (
    <Text
      accessibilityRole={header ? 'header' : undefined}
      numberOfLines={numberOfLines}
      className={className}
      style={[serif ? { ...s.serif, ...serif } : s.fallback, style]}
    >
      {children}
    </Text>
  );
}
