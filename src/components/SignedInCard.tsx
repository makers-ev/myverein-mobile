import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';

/** "Signed in as" card with a settings shortcut, shared by Home and Dashboard. */
export default function SignedInCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 flex-row items-center" style={{ gap: 12 }}>
      <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm" numberOfLines={1}>
        {t('home.signed-in-as').replace('{email}', user?.email ?? '')}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('home.go-to-settings')}
        onPress={onOpenSettings}
        className="min-h-[44px] justify-center"
      >
        <Text className="text-primary dark:text-primary-dark font-semibold">{t('home.go-to-settings')}</Text>
      </TouchableOpacity>
    </View>
  );
}
