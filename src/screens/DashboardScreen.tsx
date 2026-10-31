import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronRight, Search } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiFetch } from '@/lib/api';
import { useMyClubs } from '@/hooks/useMyClubs';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import type { CalendarEvent } from '@/hooks/useEvents';
import SickNoteCard from '@/components/privacy/SickNoteCard';
import WhoIsAbsentCard from '@/components/privacy/WhoIsAbsentCard';
import { useToday } from '@/hooks/useToday';
import { useWards } from '@/hooks/useWards';
import { isTodayEmpty } from '@/lib/today';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import NoClubChoices from '@/components/onboarding/NoClubChoices';
import TodoSection from '@/components/today/TodoSection';
import BoardSection from '@/components/today/BoardSection';
import SetupChecklist from '@/components/today/SetupChecklist';
import BentoTile from '@/components/ui/BentoTile';
import FadeIn from '@/components/ui/FadeIn';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const LOOKAHEAD_DAYS = 90;

/** Earliest event starting now or later within the lookahead window (`GET /events?clubId=&from=&to=`). */
function useNextEvent(clubId: string | null) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(!!clubId);
  const [error, setError] = useState(false);

  // Only the newest request may write state (club switch / retry bump this).
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++requestId.current;
    if (!clubId) {
      setEvent(null);
      setLoading(false);
      return;
    }
    setEvent(null);
    setLoading(true);
    setError(false);
    try {
      const from = new Date();
      const to = new Date(from.getTime() + LOOKAHEAD_DAYS * 86400000);
      const params = new URLSearchParams({ clubId, from: from.toISOString(), to: to.toISOString() });
      const { data } = await apiFetch<{ data: CalendarEvent[] }>(`/events?${params.toString()}`);
      const now = from.toISOString();
      const upcoming = data.filter((e) => e.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      if (reqId === requestId.current) setEvent(upcoming[0] ?? null);
    } catch {
      if (reqId === requestId.current) setError(true);
    } finally {
      if (reqId === requestId.current) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { event, loading, error, refetch };
}

/**
 * "Heute" (Wave 14 N2): the first thing a member sees. What needs them (missing answers, cancellations, unread messages,
 * returns due, open votes), the next event, and for board roles the to-dos and member count. Everything comes from
 * `GET /clubs/:clubId/today`, where the server decides what the caller may see (no permission logic on the device).
 * Parents see a "Meine Kinder" entry; guardian-only accounts start on the ward view instead (GuardianStartRedirect).
 */
export default function DashboardScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const { activeClub, error: clubsError, loading: clubsLoading, refetch: refetchClubs } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { event, loading: eventLoading, error: eventError, refetch: refetchEvent } = useNextEvent(clubId);
  const { membership, can } = useOwnMembership(clubId);
  const { today, loading: todayLoading, error: todayError, reload: reloadToday } = useToday(clubId);
  const { hasWards } = useWards();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reloadToday(), refetchEvent(), refetchClubs()]);
    } finally {
      setRefreshing(false);
    }
  };

  const eventLabel = t('today.next-event');
  let eventBody: React.ReactNode;
  if (eventLoading) {
    eventBody = <Skeleton lines={2} />;
  } else if (eventError) {
    eventBody = <ErrorState fallbackKey="dashboard.next-event.error" onRetry={() => void refetchEvent()} />;
  } else if (!event) {
    eventBody = <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('dashboard.next-event.empty')}</Text>;
  } else {
    const start = new Date(event.startsAt);
    eventBody = (
      <View>
        <Text className="text-foreground dark:text-foreground-dark text-lg font-bold" numberOfLines={2}>
          {event.title}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-1">
          {start.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })},{' '}
          {start.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }
  const canOpenCalendar = !!activeClub && !eventError;

  let main: React.ReactNode;
  if (clubsLoading) {
    main = <Skeleton lines={5} />;
  } else if (!activeClub && clubsError) {
    main = <ErrorState fallbackKey="club-switcher.error" onRetry={() => void refetchClubs()} />;
  } else if (!activeClub) {
    main = <NoClubChoices />;
  } else {
    main = (
      <>
        {today?.setup ? (
          <FadeIn>
            <SetupChecklist setup={today.setup} />
          </FadeIn>
        ) : null}

        {todayLoading && !today ? <Skeleton lines={4} /> : null}
        {todayError && !today ? <ErrorState error={todayError} fallbackKey="today.error" onRetry={() => void reloadToday()} /> : null}
        {today && isTodayEmpty(today) ? (
          <EmptyState title={t('today.empty.title')} hint={t('today.empty.body')} action={<Button variant="secondary" label={t('today.empty.action')} onPress={() => navigation.navigate('Kalender')} />} />
        ) : null}
        {today && !isTodayEmpty(today) ? (
          <FadeIn>
            <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-lg font-extrabold mb-2">
              {t('today.section.todo')}
            </Text>
            <TodoSection today={today} />
          </FadeIn>
        ) : null}

        <FadeIn delay={25}>
          <BentoTile minHeight={120} onPress={canOpenCalendar ? () => navigation.navigate('Kalender') : undefined} accessibilityLabel={eventLabel}>
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <CalendarDays size={18} color={colors.primary} />
              <Text className="flex-1 text-primary dark:text-primary-dark text-xs font-bold uppercase tracking-wider">{eventLabel}</Text>
              {canOpenCalendar ? <ChevronRight size={18} color={colors.mutedForeground} /> : null}
            </View>
            {eventBody}
          </BentoTile>
        </FadeIn>

        {today?.board ? (
          <FadeIn delay={50}>
            <BoardSection board={today.board} />
          </FadeIn>
        ) : null}

        {membership ? (
          <FadeIn delay={75}>
            <SickNoteCard key={activeClub.clubId} clubId={activeClub.clubId} />
          </FadeIn>
        ) : null}

        {can('absences:read') ? (
          <FadeIn delay={100}>
            <WhoIsAbsentCard key={activeClub.clubId} clubId={activeClub.clubId} />
          </FadeIn>
        ) : null}
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />}
      >
        <View className="p-6" style={{ gap: 12 }}>
          <View className="mb-1">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-2xl font-extrabold">
                  {t('today.title')}
                </Text>
                {activeClub ? (
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-0.5" numberOfLines={1}>
                    {activeClub.clubName}
                  </Text>
                ) : null}
              </View>
              {activeClub ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('search.open')}
                  onPress={() => navigation.navigate('Suche')}
                  className="items-center justify-center rounded-full bg-muted dark:bg-muted-dark"
                  style={{ width: 48, height: 48 }}
                >
                  <Search size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <ClubSwitcher />
          </View>

          {hasWards ? (
            <BentoTile minHeight={72} onPress={() => navigation.navigate('Heute')} accessibilityLabel={`${t('today.wards')}. ${t('today.wards.hint')}`}>
              <Text className="text-foreground dark:text-foreground-dark font-bold">{t('today.wards')}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-0.5">{t('today.wards.hint')}</Text>
            </BentoTile>
          ) : null}

          {main}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
