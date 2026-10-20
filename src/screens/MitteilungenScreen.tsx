import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Pin } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useClubInbox, type InboxMessage } from '@/hooks/useClubInbox';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import ClubsLoadError from '@/components/verein/ClubsLoadError';
import FormSheet from '@/components/ui/FormSheet';
import PushPrompt from '@/components/push/PushPrompt';
import PushNotice from '@/components/push/PushNotice';
import { usePushScreenTarget } from '@/notifications/usePushScreenTarget';

function MessageCard({ message, onPress }: { message: InboxMessage; onPress: () => void }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const unread = !message.readAt;

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? `${t('mitteilungen.unread')}: ` : ''}${message.urgent ? `${t('mitteilungen.urgent')}: ` : ''}${message.title}`}
      className={`flex-row bg-card dark:bg-card-dark border rounded-2xl mb-3 overflow-hidden ${
        message.urgent ? 'border-destructive' : 'border-border dark:border-border-dark'
      }`}
    >
      <View style={{ width: 4, backgroundColor: unread ? themeColors.primary : 'transparent' }} />
      <View className="flex-1 p-3">
        <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
          {message.urgent ? (
            <View className="flex-row items-center bg-destructive px-2 py-0.5 rounded-full" style={{ gap: 4 }}>
              <AlertTriangle size={12} color="#ffffff" />
              <Text className="text-xs font-bold text-white">{t('mitteilungen.urgent')}</Text>
            </View>
          ) : null}
          {message.pinned ? (
            <View className="flex-row items-center bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full" style={{ gap: 4 }}>
              <Pin size={12} color={themeColors.mutedForeground} />
              <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('mitteilungen.pinned')}</Text>
            </View>
          ) : null}
          {unread ? (
            <View className="bg-primary dark:bg-primary-dark px-2 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-primary-foreground dark:text-primary-foreground-dark">{t('mitteilungen.unread')}</Text>
            </View>
          ) : null}
        </View>
        <Text className={`text-foreground dark:text-foreground-dark text-sm mt-1 ${unread ? 'font-bold' : 'font-medium'}`}>{message.title}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-1" numberOfLines={2}>
          {message.body}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-right mt-1.5" style={{ fontSize: 11 }}>
          {[message.authorName, message.sentAt ? new Date(message.sentAt).toLocaleDateString(language) : null].filter(Boolean).join(' - ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Club inbox / "Schwarzes Brett" (Wave 9 M1): the member's own in-app messages of the active
 * club, pinned first, urgent marked, unread highlighted. Deliberately separate from
 * `NotificationsScreen`, which shows platform notices from the operator (the bell in the Navbar).
 * Read-only for everyone -- authoring stays on the website (`announcements:write`).
 * Opening a message marks it read. A tapped push (M3) opens the detail sheet by `announcementId`
 * (after a fresh load); a withdrawn or invisible message gives a friendly notice instead of an
 * error. The one-time `PushPrompt` (M2) explains push before the system dialog.
 */
export default function MitteilungenScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { activeClub, error: clubsError, loading: clubsLoading } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { messages, loading, error, refetch, markRead } = useClubInbox(clubId);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = messages.find((m) => m.id === openId) ?? null;
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const { target, ready, unreachable, consume } = usePushScreenTarget('Mitteilungen');

  // Tapped push (M3): handled once; the target is consumed first so re-renders cannot repeat it.
  useEffect(() => {
    if (!target || (!ready && !unreachable)) return;
    consume();
    if (unreachable) {
      setNoticeKey('push.notice.club-gone');
      return;
    }
    if (target.kind !== 'announcement') {
      setNoticeKey(null);
      return;
    }
    void (async () => {
      const fresh = await refetch();
      if (fresh === null) {
        setNoticeKey('push.notice.load-failed');
        return;
      }
      const found = fresh.find((m) => m.announcementId === target.announcementId);
      if (!found) {
        setNoticeKey('push.notice.announcement-gone');
        return;
      }
      setNoticeKey(null);
      setOpenId(found.id);
      if (!found.readAt) void markRead(found.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ready, unreachable]);

  const handleOpen = (message: InboxMessage) => {
    setOpenId(message.id);
    if (!message.readAt) void markRead(message.id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">{t('mitteilungen.title')}</Text>
        {activeClub ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-2" numberOfLines={1}>
            {activeClub.clubName}
          </Text>
        ) : null}
        <ClubSwitcher />
        <PushNotice messageKey={noticeKey} onDismiss={() => setNoticeKey(null)} />
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !activeClub ? (
        <View className="px-6 pt-6">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('verein.no-club.title')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.no-club.body')}</Text>
        </View>
      ) : (
        <ScrollView
          key={activeClub.clubId}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={themeColors.primary} />}
        >
          <PushPrompt />
          {loading && messages.length === 0 && !error ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
          ) : error && messages.length === 0 ? (
            <View>
              <Text className="text-destructive text-sm mb-2">{apiErrorMessage(error, t)}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => void refetch()} className="min-h-[44px] justify-center self-start">
                <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : messages.length === 0 ? (
            <View className="items-center py-10">
              <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('mitteilungen.empty.title')}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm text-center">{t('mitteilungen.empty.body')}</Text>
            </View>
          ) : (
            <>
              {error ? <Text className="text-destructive text-xs mb-3">{t('mitteilungen.refresh-failed')}</Text> : null}
              {messages.map((message) => (
                <MessageCard key={message.id} message={message} onPress={() => handleOpen(message)} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <FormSheet visible={!!open} title={open?.title ?? ''} onClose={() => setOpenId(null)} cancelLabel={t('mitteilungen.close')}>
        {open ? (
          <View>
            <View className="flex-row items-center flex-wrap mb-3" style={{ gap: 6 }}>
              {open.urgent ? (
                <View className="bg-destructive px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-bold text-white">{t('mitteilungen.urgent')}</Text>
                </View>
              ) : null}
              {open.pinned ? (
                <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('mitteilungen.pinned')}</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-foreground dark:text-foreground-dark text-base">{open.body}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-4">
              {[open.authorName, open.sentAt ? new Date(open.sentAt).toLocaleString() : null].filter(Boolean).join(' - ')}
            </Text>
          </View>
        ) : null}
      </FormSheet>
    </SafeAreaView>
  );
}
