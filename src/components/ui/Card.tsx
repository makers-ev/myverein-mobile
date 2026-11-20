import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';
import { useElevation } from '@/theme/elevation';
import PressScale from './PressScale';
import Surface from './Surface';

interface Props {
  /** Heading/S title. */
  title?: string;
  /** Body/M muted text under the title. */
  body?: string;
  icon?: LucideIcon;
  /** `summary`: a fact or KPI. `action`: content with its own actions (children). */
  variant?: 'summary' | 'action';
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Card (Figma `Card / Summary` and `Card / Action`): card surface, radius 22 (`rounded-card`), padding 16, soft shadow instead of a border (dark mode: lighter surface step). Only for
 * content that has its own actions or stands alone; lists of destinations belong in a `ListSection`.
 */
export default function Card({ title, body, icon: Icon, variant = 'summary', children, onPress, accessibilityLabel }: Props) {
  const colors = useThemeColors();
  const shadow = useElevation('card');
  const cls = 'bg-card dark:bg-card-dark rounded-card p-4';
  const content = (
    <>
      {title || Icon ? (
        <View className="flex-row items-start" style={{ gap: 12 }}>
          {Icon ? (
            <View className="bg-muted dark:bg-muted-dark rounded-tile items-center justify-center" style={{ width: 32, height: 32 }}>
              <Icon size={18} strokeWidth={1.75} color={colors.foreground} />
            </View>
          ) : null}
          <View className="flex-1">
            {title ? (
              <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold">
                {title}
              </Text>
            ) : null}
            {body ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-0.5">{body}</Text> : null}
          </View>
        </View>
      ) : null}
      {children ? <View className={title || Icon ? (variant === 'action' ? 'mt-4' : 'mt-3') : ''}>{children}</View> : null}
    </>
  );
  if (!onPress) return <Surface className="p-4">{content}</Surface>;
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [title, body].filter(Boolean).join('. ')} onPress={onPress} scale={0.99} className={cls} style={shadow}>
      {content}
    </PressScale>
  );
}
