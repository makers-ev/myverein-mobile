import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Megaphone, Pin } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMyClubs } from '@/hooks/useMyClubs';
import { INBOX_PAGE_SIZE, useClubInbox, type InboxMessage } from '@/hooks/useClubInbox';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import ClubsLoadError from '@/components/verein/ClubsLoadError';
import FormSheet from '@/components/ui/FormSheet';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Banner from '@/components/ui/Banner';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import FilterChip from '@/components/ui/FilterChip';
import PressScale from '@/components/ui/PressScale';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Skeleton from '@/components/ui/Skeleton';
import PushPrompt from '@/components/push/PushPrompt';
import PushNotice from '@/components/push/PushNotice';
import { usePushScreenTarget } from '@/notifications/usePushScreenTarget';
import { lookupAnnouncement } from '@/notifications/pushLogic';

/** "09:12" today, "Gestern", else "Di., 3. Nov." -- short and tabular. */
function when(iso: string | null, language: string, yesterday: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  if (d.getTime() >= startOfToday - 86400000) return yesterday;
  return d.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' });
}

function MessageRow({ message, divider, onPress }: { message: InboxMessage; divider: boolean; onPress: () => void }) {
  const { t, language } = useLanguage();
  const unread = !message.readAt;
  const time = when(message.sentAt, language, t('mitteilungen.yesterday'));

  return (
    <View>
      {divider ? <View className="bg-border dark:bg-border-dark" style={{ height: 1, marginLeft: 60 }} /> : null}
      <PressScale
        onPress={onPress}
        scale={0.99}
        accessibilityRole="button"
        accessibilityLabel={[unread ? t('mitteilungen.unread') : null, message.urgent ? t('mitteilungen.urgent') : null, message.title, message.authorName, time].filter(Boolean).join(', ')}
        className="flex-row px-4 py-3"
        style={{ gap: 12 }}
      >
        <View>
          <Avatar name={message.authorName ?? '?'} size="S" />
          {/* Unread: a primary dot on the avatar plus the semibold title (and the word for screen readers). */}
          {unread ? (
            <View className="absolute bg-primary dark:bg-primary-dark border-2 border-card dark:border-card-dark rounded-full" style={{ width: 12, height: 12, top: -2, left: -2 }} />
          ) : null}
        </View>
        <View className="flex-1">
          <View className="flex-row items-start" style={{ gap: 8 }}>
            <Text className={`flex-1 text-foreground dark:text-foreground-dark text-[17px] leading-[22px] ${unread ? 'font-semibold' : ''}`}>{message.title}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[22px]" style={{ fontVariant: ['tabular-nums'] }}>
              {time}
            </Text>
          </View>
          {message.urgent || message.pinned ? (
            <View className="flex-row flex-wrap mt-1" style={{ gap: 6 }}>
              {message.urgent ? (
                <Badge tone="danger" icon={AlertTriangle}>
                  {t('mitteilungen.urgent')}
                </Badge>
              ) : null}
              {message.pinned ? (
                <Badge icon={Pin}>{t('mitteilungen.pinned')}</Badge>
              ) : null}
            </View>
          ) : null}
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-1" numberOfLines={2}>
            {message.body}
          </Text>
          {message.authorName ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-1">{message.authorName}</Text> : null}
        </View>
      </PressScale>
    </View>
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
  const [unreadOnly, setUnreadOnly] = useState(false);
  const shown = unreadOnly ? messages.filter((m) => !m.readAt) : messages;
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
        // A full page means older messages were not loaded: do not claim it is gone.
        const lookup = lookupAnnouncement(fresh, target.announcementId, INBOX_PAGE_SIZE);
        setNoticeKey(lookup === 'unknown' ? 'push.notice.announcement-unknown' : 'push.notice.announcement-gone');
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
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScreenHeader title={t('nav.mitteilungen')} context={activeClub ? <ClubSwitcher /> : undefined} />
      <View className="px-4">
        <PushNotice messageKey={noticeKey} onDismiss={() => setNoticeKey(null)} />
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primaryText} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !activeClub ? (
        <View className="px-4">
          <EmptyState icon={Megaphone} title={t('verein.no-club.title')} hint={t('verein.no-club.body')} />
        </View>
      ) : (
        <ScrollView
          key={activeClub.clubId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={themeColors.primaryText} />}
        >
          <PushPrompt />
          {loading && messages.length === 0 && !error ? (
            <Skeleton shape="rows" lines={4} />
          ) : error && messages.length === 0 ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : messages.length === 0 ? (
            <EmptyState align="center" icon={Megaphone} title={t('mitteilungen.empty.title')} hint={t('mitteilungen.empty.body')} />
          ) : (
            <>
              <View className="flex-row mb-3" style={{ gap: 8 }}>
                <FilterChip label={t('mitteilungen.filter.all')} selected={!unreadOnly} onPress={() => setUnreadOnly(false)} />
                <FilterChip label={t('mitteilungen.filter.unread')} selected={unreadOnly} onPress={() => setUnreadOnly(true)} />
              </View>
              {error ? (
                <View className="mb-3">
                  <Banner tone="warning" body={t('mitteilungen.refresh-failed')} action={{ label: t('connection.retry'), onPress: () => void refetch() }} />
                </View>
              ) : null}
              {shown.length === 0 ? (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] px-1 py-2">{t('mitteilungen.filter.unread-empty')}</Text>
              ) : (
                <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] overflow-hidden">
                  {shown.map((message, i) => (
                    <MessageRow key={message.id} divider={i > 0} message={message} onPress={() => handleOpen(message)} />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <FormSheet visible={!!open} title={open?.title ?? ''} onClose={() => setOpenId(null)} cancelLabel={t('mitteilungen.close')}>
        {open ? (
          <View>
            <View className="flex-row items-center flex-wrap mb-3" style={{ gap: 6 }}>
              {open.urgent ? (
                <Badge tone="danger" icon={AlertTriangle}>
                  {t('mitteilungen.urgent')}
                </Badge>
              ) : null}
              {open.pinned ? <Badge icon={Pin}>{t('mitteilungen.pinned')}</Badge> : null}
            </View>
            <Text selectable className="text-foreground dark:text-foreground-dark text-[17px] leading-6">{open.body}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-4">
              {[open.authorName, open.sentAt ? new Date(open.sentAt).toLocaleString() : null].filter(Boolean).join(' - ')}
            </Text>
          </View>
        ) : null}
      </FormSheet>
    </SafeAreaView>
  );
}
