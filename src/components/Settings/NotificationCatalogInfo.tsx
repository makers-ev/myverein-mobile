import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

/** Groups of the backend's notification catalog, in display order (texts: `settings.notifications.info.<key>.*`). */
export const NOTIFICATION_INFO_GROUPS = ['announcements', 'events', 'meetings', 'reminders', 'decisions', 'security'] as const;

/**
 * Collapsed-by-default explanation "Welche Benachrichtigungen gibt es?" (static i18n, derived from the
 * backend README's notification catalog). No request: the text is the same for everybody.
 */
export default function NotificationCatalogInfo() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View className="mb-3">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between min-h-[44px]"
      >
        <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('settings.notifications.info.title')}</Text>
        <Chevron size={16} color={themeColors.primary} />
      </TouchableOpacity>
      {open ? (
        <View className="bg-muted dark:bg-muted-dark rounded-xl p-3" style={{ gap: 8 }}>
          {NOTIFICATION_INFO_GROUPS.map((group) => (
            <View key={group}>
              <Text className="text-foreground dark:text-foreground-dark text-sm font-bold">{t(`settings.notifications.info.${group}.title`)}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t(`settings.notifications.info.${group}.body`)}</Text>
            </View>
          ))}
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('settings.notifications.info.channels')}</Text>
        </View>
      ) : null}
    </View>
  );
}
