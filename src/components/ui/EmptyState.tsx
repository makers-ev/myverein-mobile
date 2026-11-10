import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';

interface Props {
  /** What will appear here ("Keine neuen Mitteilungen"). */
  title: string;
  /** One sentence that says what happens next or what to do. */
  hint?: string;
  /** The single next action (a `Button`), only when the viewer may do it (gate it by `permissions`). */
  action?: ReactNode;
  /** Optional line icon in a quiet 44pt tile above the title. */
  icon?: LucideIcon;
  /** `center` for a whole-screen empty state, `start` (default) inside a section. */
  align?: 'start' | 'center';
}

/** Designed empty state (Figma `Feedback / Empty`): what is missing, what happens next. Same name and props as the website's `EmptyState`. */
export default function EmptyState({ title, hint, action, icon: Icon, align = 'start' }: Props) {
  const colors = useThemeColors();
  const center = align === 'center';
  return (
    <View className={`py-6 ${center ? 'items-center px-6' : ''}`}>
      <View accessible accessibilityLabel={hint ? `${title}. ${hint}` : title} className={center ? 'items-center' : ''}>
        {Icon ? (
          <View className="bg-muted dark:bg-muted-dark rounded-full items-center justify-center mb-3" style={{ width: 44, height: 44 }}>
            <Icon size={20} strokeWidth={1.75} color={colors.mutedForeground} />
          </View>
        ) : null}
        <Text className={`text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold ${center ? 'text-center' : ''}`}>{title}</Text>
        {hint ? <Text className={`text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-1 ${center ? 'text-center' : ''}`}>{hint}</Text> : null}
      </View>
      {action ? <View className={`mt-4 ${center ? 'self-center' : 'self-start'}`}>{action}</View> : null}
    </View>
  );
}
