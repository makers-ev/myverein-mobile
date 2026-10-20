import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { usePush } from '@/notifications/PushProvider';

/**
 * One-time hint on the club inbox (after the member has seen it for the first time): explains push
 * before the system dialog appears. Hidden once dismissed, enabled, denied or on unsupported setups.
 */
export default function PushPrompt() {
  const { t } = useLanguage();
  const { promptVisible, busy, enable, dismissPrompt } = usePush();
  if (!promptVisible) return null;

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3">
      <Text className="text-foreground dark:text-foreground-dark text-sm font-bold">{t('push.prompt.title')}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{t('push.prompt.body')}</Text>
      <View className="flex-row mt-2" style={{ gap: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            dismissPrompt();
            void enable();
          }}
          className="bg-primary dark:bg-primary-dark rounded-xl min-h-[44px] items-center justify-center px-4"
        >
          <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('push.enable')}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={dismissPrompt} className="min-h-[44px] items-center justify-center px-3">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark font-semibold">{t('push.not-now')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
