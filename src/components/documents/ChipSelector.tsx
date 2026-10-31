import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';

export interface Chip {
  key: string;
  label: string;
  sub: string | null;
}

/** Horizontal radio chips (>= 48pt) to pick whose data a screen shows (own storage / one chip per child / club). */
export default function ChipSelector({ chips, selectedKey, onSelect }: { chips: Chip[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  if (chips.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {chips.map((s) => {
        const active = s.key === selectedKey;
        return (
          <TouchableOpacity
            key={s.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={s.sub ? `${s.label}, ${s.sub}` : s.label}
            onPress={() => onSelect(s.key)}
            className={`rounded-2xl px-4 justify-center border ${active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'bg-card dark:bg-card-dark border-border dark:border-border-dark'}`}
            style={{ minHeight: 48 }}
          >
            <Text className={`text-sm font-bold ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`} numberOfLines={1}>
              {s.label}
            </Text>
            <Text className={`text-xs ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`} numberOfLines={1}>
              {s.sub}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
