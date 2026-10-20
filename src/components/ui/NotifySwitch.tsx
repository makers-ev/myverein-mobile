import React from 'react';
import { Switch, Text, View } from 'react-native';

import { useThemeColors } from '@/theme/colors';

interface Props {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/** Labeled "notify" switch shared by the event and meeting author flows (default on is the caller's state). */
export default function NotifySwitch({ label, hint, value, onChange, disabled }: Props) {
  const themeColors = useThemeColors();
  return (
    <View className="bg-muted dark:bg-muted-dark rounded-xl p-3 mb-3">
      <View className="flex-row items-center justify-between" style={{ gap: 12, minHeight: 44 }}>
        <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm font-semibold">{label}</Text>
        <Switch
          accessibilityLabel={label}
          trackColor={{ false: themeColors.border, true: themeColors.primary }}
          thumbColor={themeColors.card}
          ios_backgroundColor={themeColors.border}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        />
      </View>
      {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{hint}</Text> : null}
    </View>
  );
}
