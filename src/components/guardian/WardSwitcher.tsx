import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { wardKey, type Ward } from '@/lib/ward';

interface Props {
  wards: Ward[];
  selected: Ward | null;
  onSelect: (key: string) => void;
}

/** Child chips. Renders nothing for a single child; shows the club name only when the children belong to several clubs. */
export default function WardSwitcher({ wards, selected, onSelect }: Props) {
  const { t } = useLanguage();
  if (wards.length < 2 || !selected) return null;
  const multiClub = new Set(wards.map((w) => w.clubId)).size > 1;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t('heute.switcher.label')} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {wards.map((w) => {
        const active = wardKey(w) === wardKey(selected);
        const open = w.openConsents > 0 ? t('heute.switcher.open-consents', { count: w.openConsents }) : null;
        return (
          <TouchableOpacity
            key={wardKey(w)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={[w.firstName ?? w.name, multiClub ? w.clubName : null, open].filter(Boolean).join(', ')}
            onPress={() => onSelect(wardKey(w))}
            className={`rounded-2xl px-4 justify-center border ${
              active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'bg-card dark:bg-card-dark border-border dark:border-border-dark'
            }`}
            style={{ minHeight: 48 }}
          >
            <Text className={`text-sm font-bold ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`} numberOfLines={1}>
              {w.firstName ?? w.name}
            </Text>
            {multiClub ? (
              <Text className={`text-xs ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`} numberOfLines={1}>
                {w.clubName}
              </Text>
            ) : null}
            {open ? (
              <View className="self-start mt-0.5 rounded-full bg-destructive px-1.5">
                <Text className="text-[10px] font-bold text-white">{open}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
