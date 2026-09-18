import React from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { withScheme } from '@/lib/withScheme';

export type ConnectionStatus = 'checking' | 'online' | 'offline';

interface ConnectionErrorScreenProps {
  status: ConnectionStatus;
  onRetry: () => void;
}

// Set once an external status page (e.g. Uptime Kuma) exists -- the link
// below only renders when this is set, so the app never ships a dead link
// in the meantime.
const STATUS_PAGE_URL = process.env.EXPO_PUBLIC_STATUS_PAGE_URL ? withScheme(process.env.EXPO_PUBLIC_STATUS_PAGE_URL) : undefined;

// Same "hidden until configured" logic as STATUS_PAGE_URL above -- an error
// tracker/report form URL (e.g. a GitHub issue template, a support form),
// shown as a second link below it.
const ERROR_REPORT_URL = process.env.EXPO_PUBLIC_ERROR_REPORT_URL ? withScheme(process.env.EXPO_PUBLIC_ERROR_REPORT_URL) : undefined;

/** Shown instead of an infinite spinner when the initial session bootstrap can't reach the backend (see AppNavigator). */
export default function ConnectionErrorScreen({ status, onRetry }: ConnectionErrorScreenProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  const dotColor =
    status === 'online' ? themeColors.success : status === 'offline' ? themeColors.destructive : themeColors.mutedForeground;
  const statusLabel =
    status === 'online' ? t('connection.status-online') : status === 'offline' ? t('connection.status-offline') : t('connection.status-checking');

  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark px-8">
      <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
        <Text className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground-dark">{statusLabel}</Text>
      </View>

      <Text className="text-lg font-bold text-center mb-2 text-foreground dark:text-foreground-dark">
        {t('connection.offline-title')}
      </Text>
      <Text className="text-sm text-center mb-6 text-muted-foreground dark:text-muted-foreground-dark">
        {t('connection.offline-description')}
      </Text>

      <TouchableOpacity
        className="bg-primary dark:bg-primary-dark rounded-lg py-3 px-6 items-center"
        onPress={onRetry}
        disabled={status === 'checking'}
      >
        {status === 'checking' ? (
          <ActivityIndicator color={themeColors.primaryForeground} />
        ) : (
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">
            {t('connection.retry')}
          </Text>
        )}
      </TouchableOpacity>

      {STATUS_PAGE_URL ? (
        <TouchableOpacity
          className="mt-5"
          onPress={() => Linking.openURL(STATUS_PAGE_URL).catch((err) => console.error('Error opening URL:', err))}
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('connection.status-link')}</Text>
        </TouchableOpacity>
      ) : null}

      {ERROR_REPORT_URL ? (
        <TouchableOpacity
          className="mt-3"
          onPress={() => Linking.openURL(ERROR_REPORT_URL).catch((err) => console.error('Error opening URL:', err))}
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('connection.report-error-link')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
