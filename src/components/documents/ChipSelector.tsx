import React from 'react';
import { ScrollView, Text } from 'react-native';

import PressScale from '@/components/ui/PressScale';

export interface Chip {
  key: string;
  label: string;
  sub: string | null;
}

/** Horizontal radio pills (44pt) to pick whose data a screen shows (own storage / one chip per child / club). */
export default function ChipSelector({ chips, selectedKey, onSelect }: { chips: Chip[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  if (chips.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {chips.map((s) => {
        const active = s.key === selectedKey;
        const text = s.sub ? `${s.label} · ${s.sub}` : s.label;
        return (
          <PressScale
            key={s.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={s.sub ? `${s.label}, ${s.sub}` : s.label}
            onPress={() => onSelect(s.key)}
            className={`rounded-full px-4 justify-center border ${active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'bg-card dark:bg-card-dark border-border-control dark:border-border-control-dark'}`}
            style={{ minHeight: 44 }}
          >
            <Text className={`text-[15px] leading-5 font-semibold ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`} numberOfLines={1}>
              {text}
            </Text>
          </PressScale>
        );
      })}
    </ScrollView>
  );
}
