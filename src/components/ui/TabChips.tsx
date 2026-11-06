import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

interface Props<T extends string> {
  tabs: readonly { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}

/** In-screen tab switcher (Kalender, Standorte, Verein): 44pt chips with 10px radius, announced as tabs with the selected state. */
export default function TabChips<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
      {tabs.map(({ value, label }) => {
        const selected = active === value;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={{ minHeight: 44, justifyContent: 'center' }}
            className={`px-4 rounded-[10px] border ${selected ? 'bg-primary dark:bg-primary-dark border-transparent' : 'bg-card dark:bg-card-dark border-border dark:border-border-dark'}`}
          >
            <Text className={`text-sm font-medium ${selected ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
