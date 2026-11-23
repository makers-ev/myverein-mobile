import React from 'react';
import { Text, View } from 'react-native';

/**
 * Small calendar leaf: month on top, day number below, the way a wall calendar shows it. Decorative (the date is also
 * written out next to it), so it is hidden from screen readers. 52 x 56, tinted tile (`primarySoft`, no border), radius `control`.
 */
export default function DateBlock({ iso, language }: { iso: string; language: string }) {
  const d = new Date(iso);
  const month = d.toLocaleDateString(language, { month: 'short' }).replace('.', '');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="bg-primary-soft dark:bg-primary-soft-dark rounded-control items-center justify-center overflow-hidden"
      style={{ width: 52, height: 56 }}
    >
      <Text maxFontSizeMultiplier={1.2} className="text-primary-soft-foreground dark:text-primary-soft-foreground-dark text-[11px] font-semibold leading-4">
        {month}
      </Text>
      <Text maxFontSizeMultiplier={1.2} className="text-primary-soft-foreground dark:text-primary-soft-foreground-dark text-xl font-bold leading-6" style={{ fontVariant: ['tabular-nums'] }}>
        {d.getDate()}
      </Text>
    </View>
  );
}
