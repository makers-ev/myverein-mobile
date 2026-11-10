import React from 'react';
import { Text, View } from 'react-native';

/**
 * Number pill (Figma `Count`). `attention` (solid red, white) means "this needs YOUR action" -- the only red count in
 * the app (open applications to decide, unread club messages in the tab bar). `quiet` is for informational numbers
 * (members, maintenance items), `primary` for a selected/highlighted count. Decorative: put the number into the row's
 * accessibility label.
 */
export default function Count({ value, tone = 'quiet', max = 99 }: { value: number; tone?: 'attention' | 'quiet' | 'primary'; max?: number }) {
  if (value <= 0) return null;
  const box =
    tone === 'attention'
      ? 'bg-destructive-fill dark:bg-destructive-fill-dark'
      : tone === 'primary'
        ? 'bg-primary-soft dark:bg-primary-soft-dark'
        : 'bg-muted dark:bg-muted-dark';
  const text =
    tone === 'attention'
      ? 'text-white'
      : tone === 'primary'
        ? 'text-primary-soft-foreground dark:text-primary-soft-foreground-dark'
        : 'text-muted-foreground dark:text-muted-foreground-dark';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`rounded-full items-center justify-center px-2 ${box}`}
      style={{ minWidth: 24, minHeight: 24 }}
    >
      <Text maxFontSizeMultiplier={1.3} className={`text-[13px] leading-[18px] font-semibold ${text}`} style={{ fontVariant: ['tabular-nums'] }}>
        {value > max ? `${max}+` : value}
      </Text>
    </View>
  );
}
