import React, { type ReactNode } from 'react';
import { TouchableOpacity, View, type ViewStyle } from 'react-native';

interface Props {
  children: ReactNode;
  /** Omit for a static (non-pressable) tile. */
  onPress?: () => void;
  accessibilityLabel?: string;
  minHeight?: number;
  /** Primary-filled tile instead of the bordered card. */
  emphasis?: boolean;
  style?: ViewStyle;
}

/** Bento grid cell: bordered card, 16px radius, 44pt+ target when pressable. */
export default function BentoTile({ children, onPress, accessibilityLabel, minHeight = 88, emphasis, style }: Props) {
  const cls = `rounded-2xl p-4 ${
    emphasis ? 'bg-primary dark:bg-primary-dark' : 'bg-card dark:bg-card-dark border border-border dark:border-border-dark'
  }`;
  if (!onPress) {
    return (
      <View className={cls} style={[{ minHeight }, style]}>
        {children}
      </View>
    );
  }
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
      onPress={onPress}
      className={cls}
      style={[{ minHeight }, style]}
    >
      {children}
    </TouchableOpacity>
  );
}
