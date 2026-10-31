import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export function ColorChip({
  label,
  color,
  active,
  onPress,
  disabled,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      // Visually compact chip, 44pt touch area.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
        active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      } ${disabled ? 'opacity-50' : ''}`}
      style={{ gap: 6 }}
    >
      {color ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
      ) : null}
      <Text
        className={`text-sm ${active ? 'text-primary-foreground dark:text-primary-foreground-dark font-bold' : 'text-foreground dark:text-foreground-dark'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
