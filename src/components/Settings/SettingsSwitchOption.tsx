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
    <View>
      <View className="flex-row items-center justify-between self-stretch bg-muted dark:bg-muted-dark rounded-[10px]" style={{ minHeight: 52 }}>
        <Text className={`flex-1 px-4 py-3 text-[17px] leading-[22px] ${textColor}`}>{infoField}</Text>
        <Switch
          trackColor={trackColor ?? { false: themeColors.borderControl, true: themeColors.primary }}
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
