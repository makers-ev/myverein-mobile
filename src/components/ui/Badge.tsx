import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONES: Record<BadgeTone, { box: string; text: string; icon: 'mutedForeground' | 'primarySoftForeground' | 'success' | 'warning' | 'destructive' | 'info' | 'accentSoftForeground' }> = {
  neutral: { box: 'bg-muted dark:bg-muted-dark', text: 'text-muted-foreground dark:text-muted-foreground-dark', icon: 'mutedForeground' },
  primary: { box: 'bg-primary-soft dark:bg-primary-soft-dark', text: 'text-primary-soft-foreground dark:text-primary-soft-foreground-dark', icon: 'primarySoftForeground' },
  success: { box: 'bg-success-soft dark:bg-success-soft-dark', text: 'text-success dark:text-success-dark', icon: 'success' },
  warning: { box: 'bg-warning-soft dark:bg-warning-soft-dark', text: 'text-warning dark:text-warning-dark', icon: 'warning' },
  danger: { box: 'bg-destructive-soft dark:bg-destructive-soft-dark', text: 'text-destructive dark:text-destructive-dark', icon: 'destructive' },
  info: { box: 'bg-info-soft dark:bg-info-soft-dark', text: 'text-info dark:text-info-dark', icon: 'info' },
  accent: { box: 'bg-accent-soft dark:bg-accent-soft-dark', text: 'text-accent-soft-foreground dark:text-accent-soft-foreground-dark', icon: 'accentSoftForeground' },
};

/**
 * Tag (Figma `Badge`): Label/S on a soft tint, 6px radius, never a pill. Role (Vorstand = `accent`), state ("Ohne
 * Konto" = `neutral`, "Dringend" = `danger`, "Zugesagt" = `success`). Text always carries the meaning, colour only
 * supports it. Same name and `tone` values as the website's `Badge`.
 */
export default function Badge({ children, tone = 'neutral', icon: Icon }: { children: ReactNode; tone?: BadgeTone; icon?: LucideIcon }) {
  const c = TONES[tone];
  const colors = useThemeColors();
  return (
    <View className={`self-start flex-row items-center px-2 py-0.5 rounded-md ${c.box}`} style={{ gap: 4 }}>
      {Icon ? <Icon size={14} strokeWidth={1.75} color={colors[c.icon]} /> : null}
      <Text className={`text-[13px] leading-[18px] font-medium ${c.text}`}>{children}</Text>
    </View>
  );
}
