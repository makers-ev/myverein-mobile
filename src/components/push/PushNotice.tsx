import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';

/** Friendly, dismissible notice for a tapped push whose content is gone -- deliberately not an error. */
export default function PushNotice({ messageKey, onDismiss }: { messageKey: string | null; onDismiss: () => void }) {
  const { t } = useLanguage();
  if (!messageKey) return null;
  return (
    <View accessibilityRole="alert" className="flex-row items-center bg-muted dark:bg-muted-dark rounded-2xl p-3 mb-3" style={{ gap: 8 }}>
      <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm">{t(messageKey)}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onDismiss} className="min-h-[44px] justify-center">
        <Text className="text-primary dark:text-primary-dark font-semibold">{t('push.notice.dismiss')}</Text>
      </TouchableOpacity>
    </View>
  );
}
