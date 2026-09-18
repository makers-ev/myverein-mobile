import React from 'react';
import { View, Text, Switch } from 'react-native';
import { useThemeColors } from '@/theme/colors';

interface SettingsSwitchOptionProps {
  infoField: string;
  selectedValue: boolean;
  onSwitchToggle: (value: boolean) => void;
  trackColor?: { false: string; true: string };
  thumbColor?: string;
  textColor?: string;
}

export function SettingsSwitchOption({
  infoField,
  selectedValue,
  onSwitchToggle,
  trackColor,
  thumbColor,
  textColor = 'text-foreground dark:text-foreground-dark',
}: SettingsSwitchOptionProps) {
  const themeColors = useThemeColors();

  return (
    <View className="items-center">
      <View className="flex-row items-center justify-between w-80 bg-muted dark:bg-muted-dark border border-border dark:border-border-dark rounded-xl">
        <Text className={`flex-1 p-4 text-lg ${textColor} text-center`}>{infoField}</Text>
        <Switch
          trackColor={trackColor ?? { false: themeColors.border, true: themeColors.primary }}
          thumbColor={thumbColor ?? themeColors.card}
          ios_backgroundColor={themeColors.border}
          onValueChange={onSwitchToggle}
          value={selectedValue}
          className={"mr-4"}
        />
      </View>
    </View>
  );
}
