import React, { useState } from 'react';
import { ActivityIndicator, Switch, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import NotificationCatalogInfo from '@/components/Settings/NotificationCatalogInfo';
import PushDeviceSection from '@/components/push/PushDeviceSection';
import { useNotificationPreferences, type PreferenceCategory } from '@/hooks/useNotificationPreferences';

/**
 * Notification settings (Wave 9 M4): category x channel matrix from
 * `GET /notification-preferences`, one `PUT` per toggle. `in_app` is shown as "always on", the
 * mandatory notices (account security, own decisions, invitation deadlines) are explained
 * but not switchable. The `push` toggles are per account; the device block below them
 * (`PushDeviceSection`, M2) asks for the system permission on tap and explains a denied one.
 */
export default function NotificationPreferencesSection({ clubId }: { clubId?: string | null } = {}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { preferences, loading, error, refetch, setEnabled } = useNotificationPreferences(clubId);
  const [saveError, setSaveError] = useState(false);

  const toggle = async (category: PreferenceCategory, channel: 'email' | 'push', value: boolean) => {
    setSaveError(false);
    const ok = await setEnabled(category, channel, value);
    if (!ok) setSaveError(true);
  };

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-base font-bold text-foreground dark:text-foreground-dark">{t('settings.section-notifications')}</Text>
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mt-0.5 mb-1">{t('settings.notifications.description')}</Text>
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1" testID="notification-scope-note">
        {preferences?.scope === 'club' ? t('settings.notifications.scope.club') : t('settings.notifications.scope.account')}
      </Text>

      <View className="mt-2">
        {loading && !preferences ? (
          <ActivityIndicator color={themeColors.primary} />
        ) : !preferences ? (
          <View>
            <Text className="text-destructive dark:text-destructive-dark text-sm mb-2">{error ? t('settings.notifications.error') : ''}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void refetch()} className="min-h-[44px] justify-center self-start">
              <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {preferences.categories.map((entry) => (
              <View key={entry.category} className="mb-3">
                <Text className="text-foreground dark:text-foreground-dark text-sm font-bold mb-1">
                  {t(`settings.notifications.category.${entry.category}`)}
                </Text>
                {entry.channels.map((ch) => (
                  <View key={ch.channel} className="flex-row items-center justify-between min-h-[44px]">
                    <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm">
                      {t(`settings.notifications.channel.${ch.channel}`)}
                    </Text>
                    {ch.switchable && ch.channel !== 'in_app' ? (
                      <Switch
                        accessibilityLabel={`${t(`settings.notifications.category.${entry.category}`)} - ${t(`settings.notifications.channel.${ch.channel}`)}`}
                        trackColor={{ false: themeColors.border, true: themeColors.primary }}
                        thumbColor={themeColors.card}
                        ios_backgroundColor={themeColors.border}
                        value={ch.enabled}
                        onValueChange={(value) => void toggle(entry.category, ch.channel as 'email' | 'push', value)}
                      />
                    ) : (
                      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('settings.notifications.always-on')}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}

            <PushDeviceSection />

            <NotificationCatalogInfo />

            <View className="bg-muted dark:bg-muted-dark rounded-xl p-3">
              <Text className="text-foreground dark:text-foreground-dark text-sm font-bold mb-0.5">{t('settings.notifications.mandatory.title')}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('settings.notifications.mandatory.body')}</Text>
            </View>
          </>
        )}
        {saveError ? <Text className="text-destructive dark:text-destructive-dark text-xs mt-2">{t('settings.notifications.save-error')}</Text> : null}
      </View>
    </View>
  );
}
