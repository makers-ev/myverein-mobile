import React from 'react';
import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';
import PressScale from './PressScale';

interface Props {
  title: string;
  hint?: string;
  onPress: () => void;
  /** Count shown as a red dot with number (unread, open items); hidden at 0. */
  badge?: number;
}

/** Navigation row (title, optional hint, chevron, optional count): the standard entry of Mehr and Verwaltung lists. 56pt high, 8pt apart. */
export default function ListRow({ title, hint, onPress, badge = 0 }: Props) {
  const colors = useThemeColors();
  const label = [title, hint, badge > 0 ? String(badge) : null].filter(Boolean).join('. ');
  return (
    <PressScale
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl px-4 py-3 mb-2 flex-row items-center justify-between"
      style={{ minHeight: 56 }}
      scale={0.99}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="flex-1 pr-3">
        <Text className="text-foreground dark:text-foreground-dark font-medium text-[15px]">{title}</Text>
        {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] mt-0.5">{hint}</Text> : null}
      </View>
      {badge > 0 ? (
        <View className="min-w-[22px] h-[22px] rounded-[10px] items-center justify-center bg-destructive px-1.5 mr-2">
          <Text className="text-[11px] font-semibold text-white">{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} strokeWidth={1.5} color={colors.mutedForeground} />
    </PressScale>
  );
}
