import React from 'react';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';
import PressScale from './PressScale';

/** 44pt icon-only button for top bars (search, add, more). The label is the accessibility name. */
export default function IconButton({ icon: Icon, label, onPress, hint }: { icon: LucideIcon; label: string; onPress: () => void; hint?: string }) {
  const colors = useThemeColors();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      scale={0.94}
      className="items-center justify-center rounded-full"
      style={{ width: 44, height: 44 }}
    >
      <Icon size={22} strokeWidth={1.75} color={colors.foreground} />
    </PressScale>
  );
}
