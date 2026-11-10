import React from 'react';
import { Pressable, Text } from 'react-native';
import { Check } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';

/**
 * Filter chip (Figma `Filter chip`): round, Label/M. Selected = primary soft tint with a check (not colour alone),
 * default = card surface with a control boundary. 40pt visual, 44pt hit area.
 */
export default function FilterChip({ label, selected, onPress, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; accessibilityLabel?: string }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      hitSlop={{ top: 2, bottom: 2 }}
      className={`flex-row items-center rounded-full px-3.5 ${selected ? 'bg-primary-soft dark:bg-primary-soft-dark' : 'bg-card dark:bg-card-dark border border-border-control dark:border-border-control-dark'}`}
      style={{ minHeight: 40, gap: 6 }}
    >
      {selected ? <Check size={16} strokeWidth={2} color={colors.primarySoftForeground} /> : null}
      <Text className={`text-[15px] leading-5 font-medium ${selected ? 'text-primary-soft-foreground dark:text-primary-soft-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}>{label}</Text>
    </Pressable>
  );
}
