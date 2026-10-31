import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
  title: string;
  hint?: string;
  onPress: () => void;
  /** Count shown as a red dot with number (unread, open items); hidden at 0. */
  badge?: number;
}

/** Navigation row (title, optional hint, chevron, optional count): the standard entry of Mehr and Verwaltung lists. */
export default function ListRow({ title, hint, onPress, badge = 0 }: Props) {
  const label = [title, hint, badge > 0 ? String(badge) : null].filter(Boolean).join('. ');
  return (
    <TouchableOpacity
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3 flex-row items-center justify-between"
      style={{ minHeight: 56 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="flex-1 pr-2">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">{title}</Text>
        {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{hint}</Text> : null}
      </View>
      {badge > 0 ? (
        <View className="min-w-[22px] h-[22px] rounded-full items-center justify-center bg-destructive px-1 mr-2">
          <Text className="text-[11px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <Text className="text-primary dark:text-primary-dark font-bold text-sm">›</Text>
    </TouchableOpacity>
  );
}
