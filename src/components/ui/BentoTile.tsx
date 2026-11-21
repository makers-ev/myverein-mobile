import React, { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useElevation } from '@/theme/elevation';
import PressScale from './PressScale';

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

/** Card tile (legacy name of `Card`): 22px radius, soft shadow, 16px padding, 44pt+ target and a 2% press scale when pressable. Prefer `Card`, `HeroCard` or a `ListSection`. */
export default function BentoTile({ children, onPress, accessibilityLabel, minHeight = 88, emphasis, style }: Props) {
  const shadow = useElevation('card');
  const cls = `rounded-card p-4 ${
    emphasis ? 'bg-primary dark:bg-primary-dark' : 'bg-card dark:bg-card-dark'
  }`;
  if (!onPress) {
    return (
      <View className={cls} style={[{ minHeight }, emphasis ? null : shadow, style]}>
        {children}
      </View>
    );
  }
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={cls}
      style={[{ minHeight }, emphasis ? null : shadow, style]}
    >
      {children}
    </PressScale>
  );
}
