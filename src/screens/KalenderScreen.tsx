import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { CalendarPlus, Clock, Ellipsis, Plus, Settings2, Timer, Users } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/AppNavigator';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMyClubs } from '@/hooks/useMyClubs';
import { apiFetch } from '@/lib/api';
import PushNotice from '@/components/push/PushNotice';
import { usePushScreenTarget } from '@/notifications/usePushScreenTarget';
import NoClubChoices from '@/components/onboarding/NoClubChoices';
import TabChips from '@/components/ui/TabChips';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import ClubsLoadError from '@/components/verein/ClubsLoadError';
import type { CalendarEvent } from '@/hooks/useEvents';
import TermineTab, { type EventFocus, type KalenderCommand } from '@/components/kalender/TermineTab';
import ScreenHeader from '@/components/ui/ScreenHeader';
import IconButton from '@/components/ui/IconButton';
import ActionSheet from '@/components/ui/ActionSheet';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { canSeeTeamHours, canTrackTime } from '@/lib/eventRights';
import VerfuegbarkeitTab from '@/components/kalender/VerfuegbarkeitTab';
import TreffenTab from '@/components/kalender/TreffenTab';

type Tab = 'termine' | 'verfuegbarkeit' | 'treffen';

/**
 * Kalender tab: Termine / Verfügbarkeit / Treffen as underline tabs directly under the top bar, the month grid right
 * below (no buttons in between). Top bar: "+" (Termin anlegen, `calendars:write` only) and "..." with the hours tools
 * (Zeiterfassung / Meine Stunden / Team-Stunden, each only for whom it applies, decision D3), "Kalender abonnieren"
 * and "Kalender verwalten" (`calendars:write`). The chosen action is handed to the Termine tab, which owns the sheets.
 */
export default function KalenderScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const route = useRoute<RouteProp<RootStackParamList, 'Kalender'>>();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'termine');
  // Opened from Mehr > Verfügbarkeit (or any link with a tab): jump there, also when the screen is already mounted.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params]);
  const { activeClub, error: clubsError, loading: clubsLoading } = useMyClubs();
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const [focus, setFocus] = useState<EventFocus | null>(null);
  const { target, ready, unreachable, consume } = usePushScreenTarget('Kalender');
  const clearFocus = useCallback(() => setFocus(null), []);
  // Loads one event (visibility is checked server-side) and lets the Termine tab jump to its day and open it.
  const openEvent = useCallback(
    async (eventId: string) => {
      if (!activeClub) return;
      try {
        const { data } = await apiFetch<{ data: CalendarEvent }>(
          `/events/${encodeURIComponent(eventId)}?clubId=${encodeURIComponent(activeClub.clubId)}`,
        );
        setFocus({ event: data });
      } catch (err) {
        const status = (err as { status?: number }).status;
        setNoticeKey(status === 403 || status === 404 ? 'push.notice.event-gone' : 'push.notice.load-failed');
      }
    },
    [activeClub],
  );
  const eventGone = useCallback(() => setNoticeKey('push.notice.event-gone'), []);
  // Opened from Heute with a specific event.
  const paramEventId = route.params?.eventId;
  useEffect(() => {
    if (!paramEventId || !activeClub) return;
    setTab('termine');
    setNoticeKey(null);
    void openEvent(paramEventId);
  }, [paramEventId, route.params, activeClub, openEvent]);

  // Tapped push (M3): load the single event (visibility is checked server-side) and let the Termine
  // tab jump to its day and open it; not found / not visible -> friendly notice, never an error.
  useEffect(() => {
    if (!target || (!ready && !unreachable)) return;
    consume();
    if (unreachable) {
      setNoticeKey('push.notice.club-gone');
      return;
    }
    setNoticeKey(null);
    // Meeting pushes open the Treffen tab; everything else starts on Termine.
    setTab(target.kind === 'calendar' && target.tab ? target.tab : 'termine');
    if (target.kind !== 'event' || !activeClub) return;
    void openEvent(target.eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ready, unreachable]);

  const { membership, can } = useOwnMembership(activeClub?.clubId ?? null);
  const canWrite = can('calendars:write');
  const trackTime = canTrackTime(membership);
  const myHours = trackTime || membership?.hasRate === true;
  const teamHours = canSeeTeamHours(membership);
  const [menuOpen, setMenuOpen] = useState(false);
  const [command, setCommand] = useState<{ kind: KalenderCommand; n: number } | null>(null);
  const run = (kind: KalenderCommand) => {
    setTab('termine');
    setCommand((prev) => ({ kind, n: (prev?.n ?? 0) + 1 }));
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScreenHeader
        title={t('nav.kalender')}
        context={activeClub ? <ClubSwitcher /> : undefined}
        actions={
          activeClub ? (
            <>
              {canWrite ? <IconButton icon={Plus} label={t('termine.new.label')} onPress={() => run('new')} /> : null}
              <IconButton icon={Ellipsis} label={t('kalender.menu.open')} onPress={() => setMenuOpen(true)} />
            </>
          ) : undefined
        }
      />
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
        <View className="px-4 pt-6">
          <NoClubChoices />
        </View>
      ) : (
        <>
          <TabChips tabs={(['termine', 'verfuegbarkeit', 'treffen'] as const).map((value) => ({ value, label: t(`kalender.tab.${value}`) }))} active={tab} onChange={setTab} />

          <ScrollView key={activeClub.clubId} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}>
            {tab === 'termine' && <TermineTab clubId={activeClub.clubId} focus={focus} onFocusHandled={clearFocus} onEventGone={eventGone} command={command} />}
            {tab === 'verfuegbarkeit' && <VerfuegbarkeitTab clubId={activeClub.clubId} />}
            {tab === 'treffen' && <TreffenTab clubId={activeClub.clubId} />}
          </ScrollView>

          <ActionSheet
            visible={menuOpen}
            title={t('ui.more')}
            onClose={() => setMenuOpen(false)}
            groups={[
              {
                title: t('kalender.menu.hours'),
                items: [
                  ...(trackTime ? [{ key: 'time', icon: Timer, label: t('time.open'), hint: t('time.open.hint'), onPress: () => run('time') }] : []),
                  ...(myHours ? [{ key: 'my', icon: Clock, label: t('time.my.open'), hint: t('time.my.hint'), onPress: () => run('myHours') }] : []),
                  ...(teamHours ? [{ key: 'team', icon: Users, label: t('time.team.open'), hint: t('time.team.hint'), onPress: () => run('teamHours') }] : []),
                ],
              },
              {
                title: t('kalender.menu.calendar'),
                items: [
                  { key: 'feeds', icon: CalendarPlus, label: t('feeds.open'), hint: t('feeds.hint'), onPress: () => run('feeds') },
                  ...(canWrite ? [{ key: 'manage', icon: Settings2, label: t('kalender.manage.open'), onPress: () => run('manage') }] : []),
                ],
              },
            ]}
          />
        </>
      )}
    </SafeAreaView>
  );
}
