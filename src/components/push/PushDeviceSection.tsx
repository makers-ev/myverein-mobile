import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { usePush } from '@/notifications/PushProvider';

/**
 * Device-level push block of the notification settings (Wave 9 M2): explains what push does, asks
 * for the system permission only on the user's tap, and for a denied permission points to the
 * device settings. Expo Go / simulator / web states are shown as plain information.
 */
export default function PushDeviceSection() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { status, busy, enable, retry, openSystemSettings } = usePush();

  return (
    <View className="bg-muted dark:bg-muted-dark rounded-xl p-3 mb-3">
      <Text className="text-foreground dark:text-foreground-dark text-sm font-bold mb-0.5">{t('push.status.title')}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t(`push.status.${status}`)}</Text>
      {status === 'registering' || busy ? <ActivityIndicator className="self-start mt-2" color={themeColors.primary} /> : null}
      {status === 'undetermined' ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void enable()}
          className="bg-primary dark:bg-primary-dark rounded-xl min-h-[44px] items-center justify-center mt-2 px-4"
        >
          <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('push.enable')}</Text>
        </TouchableOpacity>
      ) : null}
      {status === 'error' ? (
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void retry()} className="min-h-[44px] justify-center self-start mt-1">
          <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
        </TouchableOpacity>
      ) : null}
      {status === 'denied' ? (
        <TouchableOpacity accessibilityRole="button" onPress={openSystemSettings} className="min-h-[44px] justify-center self-start mt-1">
          <Text className="text-primary dark:text-primary-dark font-semibold">{t('push.open-settings')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
