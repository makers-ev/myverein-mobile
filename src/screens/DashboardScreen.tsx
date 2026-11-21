import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Baby, CalendarDays, IdCard, Search } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiFetch } from '@/lib/api';
import { rsvpPath, type MyRsvp, type RegistrationInfo } from '@/lib/eventRegistration';
import { useRsvpActions } from '@/hooks/useEventRegistration';
import { useMyClubs } from '@/hooks/useMyClubs';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import type { CalendarEvent } from '@/hooks/useEvents';
import SickNoteCard from '@/components/privacy/SickNoteCard';
import WhoIsAbsentCard from '@/components/privacy/WhoIsAbsentCard';
import { useToday } from '@/hooks/useToday';
import { useWards } from '@/hooks/useWards';
import { useClubInbox } from '@/hooks/useClubInbox';
import { isTodayEmpty } from '@/lib/today';
import { pickHero } from '@/lib/heroPick';
import { createSingleFlight, quickRsvp } from '@/lib/quickRsvp';
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

  // `silent` keeps the shown event on screen while it reloads (after a sign-up, on focus), so the hero never flickers.
  const refetch = useCallback(async (silent = false) => {
    const reqId = ++requestId.current;
    if (!clubId) {
      setEvent(null);
      setLoading(false);
      return;
    }
    if (!silent) {
      setEvent(null);
      setLoading(true);
    }
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
  const { submit: submitRsvp } = useRsvpActions(clubId);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const flight = useRef(createSingleFlight()).current;
  // Outcome of the last one-tap sign-up, bound to club + event: another club or another hero event never shows it.
  const [rsvpOutcome, setRsvpOutcome] = useState<{ clubId: string; eventId: string; status?: 'angemeldet' | 'warteliste'; errorKey?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Back on the tab (another device may have changed the answer): reload quietly, without skeletons.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void reloadToday();
      void refetchEvent(true);
    }, [reloadToday, refetchEvent]),
  );

  const handleRefresh = async () => {
    setRsvpOutcome(null);
    setRefreshing(true);
    try {
      await Promise.all([reloadToday(), refetchEvent(), refetchClubs()]);
    } finally {
      setRefreshing(false);
    }
  };

  // One tap from the hero (see `quickRsvp`): details needed -> event sheet, existing sign-up -> untouched, errors -> message.
  const runQuickRsvp = async (eventId: string) => {
    if (!clubId) return;
    const result = await flight(async () => {
      setRsvpBusy(true);
      setRsvpOutcome(null);
      const q = `clubId=${encodeURIComponent(clubId)}`;
      try {
        return await quickRsvp({
          fetchRegistration: async () => (await apiFetch<{ data: RegistrationInfo }>(`/events/${encodeURIComponent(eventId)}/registration?${q}`)).data,
          fetchMine: async () => (await apiFetch<{ data: MyRsvp | null }>(rsvpPath(eventId, clubId, null))).data ?? null,
          submit: () => submitRsvp(eventId, { form: null, maxCompanions: 0 }, { partySize: 1, answers: {}, forClubMemberId: null }),
        });
      } finally {
        setRsvpBusy(false);
      }
    });
    if (!result) return;
    if (result.kind === 'details') {
      navigation.navigate('Kalender', { tab: 'termine', eventId });
      return;
    }
    if (result.kind === 'error') {
      setRsvpOutcome({ clubId, eventId, errorKey: result.errorKey });
      AccessibilityInfo.announceForAccessibility(t(result.errorKey));
      return;
    }
    setRsvpOutcome({ clubId, eventId, status: result.status });
    AccessibilityInfo.announceForAccessibility(t(result.status === 'warteliste' ? 'today.hero.waitlist' : 'today.hero.going'));
    void reloadToday();
    void refetchEvent(true);
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
    const outcome = rsvpOutcome && rsvpOutcome.clubId === clubId && rsvpOutcome.eventId === e.id ? rsvpOutcome : null;
    const done = outcome?.status ?? null;
    const rsvpError = outcome?.errorKey ? t(outcome.errorKey) : null;
    const myRsvp = done ?? e.myRsvp;
    const needsAnswer = !done && !!today?.openRsvps.some((r) => r.eventId === e.id);
    const status = e.cancelled
      ? t('today.hero.cancelled')
      : myRsvp === 'angemeldet'
        ? t('today.hero.going')
        : myRsvp === 'warteliste'
          ? t('today.hero.waitlist')
          : typeof e.attendeeCount === 'number' && e.attendeeCount > 0
            ? t('today.hero.attendees', { count: e.attendeeCount })
            : null;
    const open = () => navigation.navigate('Kalender', { tab: 'termine', eventId: e.id });
    heroNode = (
      <HeroCard eyebrow={`${dayLabel} · ${range}`} title={e.title} meta={rsvpError ?? status ?? undefined}>
        {needsAnswer && !e.cancelled ? (
          <>
            <Button variant="inverse" label={t('termine.rsvp')} loading={rsvpBusy} onPress={() => void runQuickRsvp(e.id)} />
            <Button variant="inverseOutline" label={t('today.hero.open')} onPress={open} />
          </>
        ) : (
          <Button variant="inverse" label={t('today.hero.open')} onPress={open} />
        )}
      </HeroCard>
    );
  } else if (hero.kind === 'board') {
    heroNode = (
      <HeroCard eyebrow={t('admin.applications.hero.eyebrow')} title={t('verein.applications.open')} meta={t('admin.applications.hint', { count: hero.count })}>
        <Button variant="inverse" label={t('admin.applications.hero.action')} onPress={() => navigation.navigate('ClubApplications')} />
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

        {today?.setup ? <SetupChecklist setup={today.setup} clubId={activeClub.clubId} /> : null}

        <View className="mt-6">
          {todayLoading && !today ? <Skeleton shape="rows" lines={3} /> : null}
          {todayError && !today ? <ErrorState error={todayError} fallbackKey="today.error" onRetry={() => void reloadToday()} /> : null}
          {today && !isTodayEmpty(today) ? (
            <TodoSection today={today} latestMessageTitle={latestUnread?.title ?? null} heroEventId={heroEventId} hideBallots={hero.kind === 'vote'} />
          ) : null}
          {today?.board ? <BoardSection board={today.board} applicationsInHero={hero.kind === 'board'} /> : null}
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
