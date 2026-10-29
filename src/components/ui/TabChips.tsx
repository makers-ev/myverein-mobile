import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';

interface Props<T extends string> {
  tabs: readonly { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}

/** In-screen tab switcher (Kalender, Standorte, Verein): pill chips, 44pt high, announced as tabs with the selected state. */
export default function TabChips<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
      {tabs.map(({ value, label }) => {
        const selected = active === value;
        return (
          <TouchableOpacity
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={{ minHeight: 44, justifyContent: 'center' }}
            className={`px-4 py-2 rounded-full ${selected ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'}`}
          >
            <Text className={`text-sm font-semibold ${selected ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
