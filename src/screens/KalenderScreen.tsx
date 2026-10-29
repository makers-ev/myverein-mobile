import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
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
import TermineTab, { type EventFocus } from '@/components/kalender/TermineTab';
import VerfuegbarkeitTab from '@/components/kalender/VerfuegbarkeitTab';
import TreffenTab from '@/components/kalender/TreffenTab';

type Tab = 'termine' | 'verfuegbarkeit' | 'treffen';

/**
 * Wave 2 (Kalender/Verfügbarkeit/Treffen) lives behind ONE new nav entry
 * with three tabs, not three separate nav entries -- the floating navbar
 * pill only has room for a few items (see Navbar.tsx), same reasoning that
 * merged Wave 1's Vereinsinfo/Mitglieder/Profil into VereinScreen's tabs.
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

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">{t('nav.kalender')}</Text>
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
          <NoClubChoices />
        </View>
      ) : (
        <>
          <View className="px-6 pt-3">
            <TabChips tabs={(['termine', 'verfuegbarkeit', 'treffen'] as const).map((value) => ({ value, label: t(`kalender.tab.${value}`) }))} active={tab} onChange={setTab} />
          </View>

          <ScrollView key={activeClub.clubId} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
            {tab === 'termine' && <TermineTab clubId={activeClub.clubId} focus={focus} onFocusHandled={clearFocus} onEventGone={eventGone} />}
            {tab === 'verfuegbarkeit' && <VerfuegbarkeitTab clubId={activeClub.clubId} />}
            {tab === 'treffen' && <TreffenTab clubId={activeClub.clubId} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
