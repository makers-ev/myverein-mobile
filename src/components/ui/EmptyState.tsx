import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';

interface Props {
  title: string;
  /** One sentence that says what to do next. */
  hint?: string;
  /** The next action, usually a `Button`. */
  action?: ReactNode;
  /** Optional line icon (18px, muted) in a quiet tile above the title. */
  icon?: LucideIcon;
}

/** Designed empty state: what is missing, what to do about it. Same name and props as the website's `EmptyState`. */
export default function EmptyState({ title, hint, action, icon: Icon }: Props) {
  const colors = useThemeColors();
  return (
    <View accessible accessibilityLabel={hint ? `${title}. ${hint}` : title} className="py-6">
      {Icon ? (
        <View className="bg-muted dark:bg-muted-dark rounded-xl items-center justify-center mb-3" style={{ width: 40, height: 40 }}>
          <Icon size={18} strokeWidth={1.5} color={colors.mutedForeground} />
        </View>
      ) : null}
      <Text className="text-foreground dark:text-foreground-dark font-semibold text-base mb-1">{title}</Text>
      {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{hint}</Text> : null}
      {action ? <View className="self-start">{action}</View> : null}
    </View>
  );
}
