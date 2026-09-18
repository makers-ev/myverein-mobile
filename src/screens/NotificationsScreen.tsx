import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, MailOpen, Trash2 } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useNotifications, useNotificationMutations, type NotificationItem } from '@/hooks/useNotifications';

type Tab = 'unread' | 'read';

/**
 * Resolves a notification's display title/body for the current language.
 * `translations` (ADR-009 jsonb column, keyed by language code) wins
 * whenever it's set -- always true for an `admin` notification, and true for
 * a `system` one only once an admin has overridden its `notification_template`
 * row (see the backend's `admin-notification-templates.ts`). Falls back to
 * the English entry if the active language has no override yet, same
 * per-key English fallback `t()` uses. A `system` notification with no
 * override at all has `translations: null`, so it falls back to rendering
 * `translationKey`/`paramsJson` through `t()`'s `{{param}}` interpolation.
 */
function useNotificationText(n: NotificationItem) {
  const { t, language } = useLanguage();
  const override = n.translations?.[language] ?? n.translations?.en;
  if (override) {
    return { title: override.title, body: override.body };
  }
  const params = (n.paramsJson ?? {}) as Record<string, string>;
  return { title: t(`${n.translationKey}.title`, params), body: t(`${n.translationKey}.body`, params) };
}

function NotificationCard({ n, onChange }: { n: NotificationItem; onChange: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { title, body } = useNotificationText(n);
  const { markRead, markUnread, deleteNotification } = useNotificationMutations();

  const handleDelete = () => {
    Alert.alert(t('notifications.delete-confirm-title'), t('notifications.delete-confirm-message'), [
      { text: t('notifications.action.cancel'), style: 'cancel' },
      {
        text: t('notifications.action.delete'),
        style: 'destructive',
        onPress: () => void deleteNotification(n.id).then(onChange),
      },
    ]);
  };

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3">
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <Text className="flex-1 text-foreground dark:text-foreground-dark font-bold text-sm">{title}</Text>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <TouchableOpacity
            onPress={() => void (n.read ? markUnread(n.id) : markRead(n.id)).then(onChange)}
            hitSlop={8}
            className="p-1"
            accessibilityLabel={t(n.read ? 'notifications.action.mark-unread' : 'notifications.action.mark-read')}
          >
            {n.read ? (
              <MailOpen size={18} color={themeColors.mutedForeground} />
            ) : (
              <Mail size={18} color={themeColors.mutedForeground} />
            )}
          </TouchableOpacity>
          {n.deletable && (
            <TouchableOpacity
              onPress={handleDelete}
              hitSlop={8}
              className="p-1"
              accessibilityLabel={t('notifications.action.delete')}
            >
              <Trash2 size={18} color={themeColors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-1" numberOfLines={2}>
        {body}
      </Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-right mt-1.5" style={{ fontSize: 11 }}>
        {new Date(n.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('unread');
  const { notifications, refetch } = useNotifications(tab);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-4">
          {t('notifications.title')}
        </Text>

        <View className="flex-row mb-4" style={{ gap: 8 }}>
          {(['unread', 'read'] as const).map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setTab(value)}
              className={`px-4 py-2 rounded-full ${
                tab === value ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  tab === value
                    ? 'text-primary-foreground dark:text-primary-foreground-dark'
                    : 'text-muted-foreground dark:text-muted-foreground-dark'
                }`}
              >
                {t(`notifications.tab.${value}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
        {notifications.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
            {t(`notifications.empty.${tab}`)}
          </Text>
        ) : (
          notifications.map((n) => <NotificationCard key={n.id} n={n} onChange={() => void refetch()} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
