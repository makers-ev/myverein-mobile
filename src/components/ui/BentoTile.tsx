import React, { type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

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

/** Card tile: hairline border, 16px radius, 16px padding, 44pt+ target and a 2% press scale when pressable. */
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={cls}
      style={({ pressed }) => [{ minHeight, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}
