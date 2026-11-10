import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Baby, CalendarDays, IdCard, Search } from 'lucide-react-native';
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
import { useClubInbox } from '@/hooks/useClubInbox';
import { isTodayEmpty, type Today } from '@/lib/today';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import HeroCard from '@/components/ui/HeroCard';
import IconButton from '@/components/ui/IconButton';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NoClubChoices from '@/components/onboarding/NoClubChoices';
import TodoSection from '@/components/today/TodoSection';
import BoardSection from '@/components/today/BoardSection';
import SetupChecklist from '@/components/today/SetupChecklist';
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

type Hero =
  | { kind: 'vote'; count: number }
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'error' };

/**
 * Hero priority (decision D7): an open vote that needs my answer, then today's next event, then the next upcoming
 * event, then a calm empty state with the next action. `useNextEvent` already returns the earliest event from now on,
 * so "today" wins over "later" by order.
 */
function pickHero(today: Today | null, event: CalendarEvent | null, eventLoading: boolean, eventError: boolean): Hero {
  if (today && today.openBallots > 0) return { kind: 'vote', count: today.openBallots };
  if (event) return { kind: 'event', event };
  if (eventLoading) return { kind: 'loading' };
  if (eventError) return { kind: 'error' };
  return { kind: 'empty' };
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * "Heute" (Wave 14 N2, "Vereinsheim" layout): one hero (open vote > next event > calm empty state), then ONE grouped
 * list of what needs the person, the founder's setup progress, "Für den Vorstand" for board roles, "Für dich" and the
 * "Krank melden" action card. Everything comes from `GET /clubs/:clubId/today`, where the server decides what the
 * caller may see (no permission logic on the device). Parents see a "Meine Kinder" row; guardian-only accounts start on
 * the ward view instead (GuardianStartRedirect).
 */
export default function DashboardScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const { activeClub, error: clubsError, loading: clubsLoading, refetch: refetchClubs } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { event, loading: eventLoading, error: eventError, refetch: refetchEvent } = useNextEvent(clubId);
  const { membership, can } = useOwnMembership(clubId);
  const { today, loading: todayLoading, error: todayError, reload: reloadToday } = useToday(clubId);
  // The newest unread message is shown once, as the preview of the Mitteilungen row (no request without unread ones).
  const { messages } = useClubInbox(today && today.unreadAnnouncements > 0 ? clubId : null);
  const latestUnread = messages.find((m) => !m.readAt) ?? null;
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

  const time = (d: Date) => d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  const hero = pickHero(today, event, eventLoading, eventError);
  let heroNode: React.ReactNode = null;
  if (hero.kind === 'vote') {
    heroNode = (
      <HeroCard eyebrow={t('today.hero.vote.eyebrow')} title={t('today.hero.vote.title')} meta={t('today.hero.vote.meta', { count: hero.count })}>
        <Button variant="inverse" label={t('today.hero.vote.action')} onPress={() => navigation.navigate('Abstimmungen')} />
      </HeroCard>
    );
  } else if (hero.kind === 'event') {
    const e = hero.event;
    const start = new Date(e.startsAt);
    const end = e.endsAt ? new Date(e.endsAt) : null;
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const dayLabel = sameDay(start, now)
      ? t('ui.today')
      : sameDay(start, tomorrow)
        ? t('today.hero.tomorrow')
        : start.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' });
    const range = e.allDay ? t('termine.all-day') : end && sameDay(start, end) ? `${time(start)} – ${time(end)}` : time(start);
    const needsAnswer = !!today?.openRsvps.some((r) => r.eventId === e.id);
    const status = e.cancelled
      ? t('today.hero.cancelled')
      : e.myRsvp === 'angemeldet'
        ? t('today.hero.going')
        : e.myRsvp === 'warteliste'
          ? t('today.hero.waitlist')
          : typeof e.attendeeCount === 'number' && e.attendeeCount > 0
            ? t('today.hero.attendees', { count: e.attendeeCount })
            : null;
    const open = () => navigation.navigate('Kalender', { tab: 'termine', eventId: e.id });
    heroNode = (
      <HeroCard eyebrow={`${dayLabel} · ${range}`} title={e.title} meta={status ?? undefined}>
        <Button variant="inverse" label={needsAnswer && !e.cancelled ? t('today.hero.rsvp.action') : t('today.hero.open')} onPress={open} />
      </HeroCard>
    );
  } else if (hero.kind === 'loading') {
    heroNode = <Skeleton shape="hero" />;
  } else if (hero.kind === 'error') {
    heroNode = <ErrorState fallbackKey="dashboard.next-event.error" onRetry={() => void refetchEvent()} />;
  } else {
    heroNode = (
      <Card icon={CalendarDays} title={t('today.hero.empty.title')} body={t('today.hero.empty.body')}>
        <View className="self-start" style={{ marginLeft: -12 }}>
          <Button variant="tertiary" size="M" label={t('today.empty.action')} onPress={() => navigation.navigate('Kalender')} />
        </View>
      </Card>
    );
  }

  const heroEventId = hero.kind === 'event' ? hero.event.id : null;

  let main: React.ReactNode;
  if (clubsLoading) {
    main = <Skeleton shape="hero" />;
  } else if (!activeClub && clubsError) {
    main = <ErrorState fallbackKey="club-switcher.error" onRetry={() => void refetchClubs()} />;
  } else if (!activeClub) {
    main = <NoClubChoices />;
  } else {
    main = (
      <>
        <FadeIn>{heroNode}</FadeIn>

        {today?.setup ? (
          <View className="mt-6">
            <SetupChecklist setup={today.setup} clubId={activeClub.clubId} />
          </View>
        ) : null}

        <View className="mt-6">
          {todayLoading && !today ? <Skeleton shape="rows" lines={3} /> : null}
          {todayError && !today ? <ErrorState error={todayError} fallbackKey="today.error" onRetry={() => void reloadToday()} /> : null}
          {today && !isTodayEmpty(today) ? (
            <TodoSection today={today} latestMessageTitle={latestUnread?.title ?? null} heroEventId={heroEventId} hideBallots={hero.kind === 'vote'} />
          ) : null}
          {today?.board ? <BoardSection board={today.board} /> : null}
          {can('absences:read') ? <WhoIsAbsentCard key={`absent-${activeClub.clubId}`} clubId={activeClub.clubId} /> : null}

          <ListSection title={t('today.section.you')} inset={60}>
            {membership ? <ListRow key="card" icon={IdCard} title={t('today.card')} hint={t('today.card.hint')} onPress={() => navigation.navigate('Mitgliedsausweis')} /> : null}
            {hasWards ? <ListRow key="wards" icon={Baby} title={t('today.wards')} hint={t('today.wards.hint')} onPress={() => navigation.navigate('Heute')} /> : null}
          </ListSection>

          {membership ? <SickNoteCard key={activeClub.clubId} clubId={activeClub.clubId} /> : null}
        </View>
      </>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primaryText} />}
      >
        <ScreenHeader
          title={t('today.title')}
          context={activeClub ? <ClubSwitcher /> : undefined}
          actions={activeClub ? <IconButton icon={Search} label={t('search.open')} onPress={() => navigation.navigate('Suche')} /> : undefined}
        />
        <View className="px-4 pt-1">{main}</View>
      </ScrollView>
    </SafeAreaView>
  );
}
