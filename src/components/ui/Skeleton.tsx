import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

interface Props {
  /** Number of placeholder lines (default 3); the last one is shorter. */
  lines?: number;
  /** `lines` (text), `rows` (list rows with a leading tile), `hero` (one tall block). */
  shape?: 'lines' | 'rows' | 'hero';
  /** Wait before showing anything (rule 7: below 300 ms show nothing). 0 shows immediately. */
  delayMs?: number;
}

/** Static loading placeholder in the shape of the content (no shimmer, so nothing loops). Hidden from screen readers. Same name as the website's `Skeleton`. */
export default function Skeleton({ lines = 3, shape = 'lines', delayMs = 300 }: Props) {
  const [visible, setVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  const bar = 'rounded-md bg-muted dark:bg-muted-dark';
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 10, opacity: visible ? 1 : 0 }} className="py-2">
      {shape === 'hero' ? <View className="rounded-[20px] bg-muted dark:bg-muted-dark" style={{ height: 156 }} /> : null}
      {shape === 'rows'
        ? Array.from({ length: lines }, (_, i) => (
            <View key={i} className="flex-row items-center" style={{ gap: 12 }}>
              <View className={bar} style={{ width: 32, height: 32 }} />
              <View className="flex-1" style={{ gap: 6 }}>
                <View className={`h-4 ${bar} ${i % 2 ? 'w-1/2' : 'w-2/3'}`} />
                <View className={`h-3 ${bar} w-1/3`} />
              </View>
            </View>
          ))
        : null}
      {shape === 'lines'
        ? Array.from({ length: lines }, (_, i) => <View key={i} className={`h-4 ${bar} ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />)
        : null}
    </View>
  );
}
