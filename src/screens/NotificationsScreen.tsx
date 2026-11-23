import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import TabChips from '@/components/ui/TabChips';
import { useNotifications, useNotificationMutations, type NotificationItem } from '@/hooks/useNotifications';
import Surface from '@/components/ui/Surface';

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

function NotificationRow({ n, first, onChange }: { n: NotificationItem; first: boolean; onChange: () => void }) {
  const { t } = useLanguage();
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
    <View className={`px-4 pt-3 pb-1 ${first ? '' : 'border-t border-divider dark:border-divider-dark'}`}>
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold">{title}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-0.5">{body}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-1" style={{ fontVariant: ['tabular-nums'] }}>
        {new Date(n.createdAt).toLocaleDateString()}
      </Text>
      <View className="flex-row items-center justify-between" style={{ marginLeft: -12, marginRight: -12 }}>
        <Button
          variant="tertiary"
          size="M"
          label={t(n.read ? 'notifications.action.mark-unread' : 'notifications.action.mark-read')}
          onPress={() => void (n.read ? markUnread(n.id) : markRead(n.id)).then(onChange)}
        />
        {n.deletable ? <Button variant="tertiary" size="M" label={t('notifications.action.delete')} onPress={handleDelete} /> : null}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('unread');
  const { notifications, loading, refetch } = useNotifications(tab);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* The stack header names the screen (no second large title). */}
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] px-4 pt-3 pb-2">{t('notifications.platform-hint')}</Text>
      <TabChips
        tabs={[
          { value: 'unread', label: t('notifications.tab.unread') },
          { value: 'read', label: t('notifications.tab.read') },
        ]}
        active={tab}
        onChange={setTab}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}>
        {loading && notifications.length === 0 ? (
          <Skeleton shape="rows" lines={3} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title={t(`notifications.empty.${tab}`)} />
        ) : (
          <Surface className="overflow-hidden">
            {notifications.map((n, i) => (
              <NotificationRow key={n.id} n={n} first={i === 0} onChange={() => void refetch()} />
            ))}
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
