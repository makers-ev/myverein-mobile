import React from 'react';
import { Text } from 'react-native';

/** Heading of a group of rows or cards: Label/S (13pt medium), muted, sentence case (never uppercase or tracked). 24pt above, 8pt below. Prefer `ListSection`'s `title` for lists. */
export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 mt-6 px-1">
      {children}
    </Text>
  );
}
