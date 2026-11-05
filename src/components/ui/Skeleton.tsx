import React from 'react';
import { View } from 'react-native';

interface Props {
  /** Number of grey text lines (default 3); the last one is shorter. */
  lines?: number;
}

/** Static loading placeholder for lists and cards (no shimmer, so nothing loops). Hidden from screen readers. Same name and props as the website's `Skeleton`. */
export default function Skeleton({ lines = 3 }: Props) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 8 }} className="py-2">
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} className={`h-4 rounded-md bg-muted dark:bg-muted-dark ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </View>
  );
}
