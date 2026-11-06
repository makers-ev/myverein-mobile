import React from 'react';
import { Text } from 'react-native';

/** Heading of a group of rows or cards: 13pt medium, muted, sentence case (never or tracked). 24pt above, 8pt below. */
export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] font-medium mb-2 mt-6">
      {children}
    </Text>
  );
}
