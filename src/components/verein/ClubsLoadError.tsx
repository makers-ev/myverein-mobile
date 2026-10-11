import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useMyClubs } from '@/hooks/useMyClubs';

/** Error state for a failed `/my-clubs` load (distinct from "no club yet"), with retry. */
export default function ClubsLoadError() {
  const { t } = useLanguage();
  const { refetch } = useMyClubs();
  return (
    <View className="px-6 pt-6">
      <Text className="text-destructive text-sm mb-2">{t('club-switcher.error')}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('connection.retry')}
        onPress={() => void refetch()}
        className="min-h-[44px] justify-center self-start"
      >
        <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}
