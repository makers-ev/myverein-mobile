import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';

type Tone = 'neutral' | 'primary' | 'danger';

const TONES: Record<Tone, { box: string; text: string }> = {
  neutral: { box: 'bg-muted dark:bg-muted-dark', text: 'text-muted-foreground dark:text-muted-foreground-dark' },
  primary: { box: 'bg-primary/10 dark:bg-primary-dark/10', text: 'text-primary dark:text-primary-dark' },
  danger: { box: 'bg-destructive/10', text: 'text-destructive' },
};

/** Small status chip (role, state, count). Same name and `tone` values as the website's `Badge`. */
export default function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <View className={`self-start px-2.5 py-1 rounded-full ${c.box}`}>
      <Text className={`text-xs font-semibold ${c.text}`}>{children}</Text>
    </View>
  );
}
