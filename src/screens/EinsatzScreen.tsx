import React, { useEffect, useState } from 'react';
import { AppState, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock, ClipboardList } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useExternalAccess } from '@/external/ExternalAccessProvider';
import { assignmentPhase, formatInstant, nextAssignmentBoundary, type ExternalAssignment } from '@/lib/outreach';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Skeleton from '@/components/ui/Skeleton';
import Surface from '@/components/ui/Surface';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import SuspendedBanner from '@/components/verein/SuspendedBanner';

type T = (key: string, params?: Record<string, string | number>) => string;

function windowText(a: ExternalAssignment, t: T, language: string): string {
  return t('einsatz.window', { from: formatInstant(a.validFrom, language) ?? '', to: formatInstant(a.validUntil, language) ?? '' });
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-0.5">{label}</Text>
      {children}
    </View>
  );
}

/** A released assignment: title, time window, place with address and the club's note. Only shown inside the window. */
function ActiveCard({ a, t, language }: { a: ExternalAssignment; t: T; language: string }) {
  const text = 'text-foreground dark:text-foreground-dark text-[17px] leading-[24px]';
  return (
    <Surface className="p-4 mb-3" style={{ gap: 12 }}>
      <View>
        <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold">{a.title}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]" style={{ fontVariant: ['tabular-nums'] }}>{windowText(a, t, language)}</Text>
      </View>
      {a.location ? (
        <Labelled label={t('einsatz.location')}>
          <Text selectable className={text}>{a.location.name}</Text>
          {a.location.address ? <Text selectable className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{a.location.address}</Text> : null}
        </Labelled>
      ) : null}
      {a.note ? (
        <Labelled label={t('einsatz.note')}>
          <Text selectable className={text}>{a.note}</Text>
        </Labelled>
      ) : null}
    </Surface>
  );
}

/**
 * Reduced start screen of the external role `dienstleister` (Wave 15 M1, Navbar tab "Heute"): only the assignments the club
 * released (`GET /external/me`): place, address and note while the time window is open, "Demnächst" with just the window
 * before it starts, nothing after it ends. The window is checked here as well as on the server (a stale list never shows
 * access details after the end). No member data and no club navigation.
 */
export default function EinsatzScreen() {
  const { t, language } = useLanguage();
  const { me, loading, error, reload } = useExternalAccess();
  const assignmentsKey = me?.assignments.map((a) => `${a.validFrom}|${a.validUntil}`).join(',') ?? '';
  const [refreshing, setRefreshing] = useState(false);
  // The clock the windows are judged by: set on open, at every window start/end (timer), on app resume and on refresh, so
  // place, address and note vanish at the end of the window even while the screen stays open.
  const [now, setNow] = useState(() => Date.now());
  const list = (me?.assignments ?? []).map((a) => ({ a, phase: assignmentPhase(a, now) }));
  const active = list.filter((x) => x.phase === 'active').map((x) => x.a);
  const upcoming = list.filter((x) => x.phase === 'upcoming').map((x) => x.a);

  useEffect(() => {
    const boundary = nextAssignmentBoundary(me?.assignments ?? [], now);
    if (boundary === null) return undefined;
    // A window opened or closed: re-judge with a fresh clock and reload (a window that just opened brings its details).
    const timer = setTimeout(() => {
      setNow(Date.now());
      void reload();
    }, Math.min(Math.max(boundary - now, 0) + 250, 2_147_000_000));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentsKey, now, reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
        void reload();
      }
    });
    return () => sub.remove();
  }, [reload]);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setNow(Date.now());
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />} contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader title={t('einsatz.title')} context={me ? <ClubSwitcher /> : undefined} />
        <SuspendedBanner />
        <View className="px-4">
          {error && !me ? (
            <ErrorState error={error} fallbackKey="einsatz.error" onRetry={() => void reload()} />
          ) : loading || !me ? (
            <Skeleton shape="rows" lines={3} />
          ) : active.length === 0 && upcoming.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t('einsatz.empty.title')} hint={t('einsatz.empty.hint')} />
          ) : (
            <>
              {active.length > 0 ? (
                <View className="mb-3">
                  <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 px-1">{t('einsatz.section.active')}</Text>
                  {active.map((a) => (
                    <ActiveCard key={a.id} a={a} t={t} language={language} />
                  ))}
                </View>
              ) : null}
              {upcoming.length > 0 ? (
                <ListSection title={t('einsatz.section.upcoming')} footer={t('einsatz.upcoming.hint')} inset={60}>
                  {upcoming.map((a) => (
                    <ListRow key={a.id} icon={CalendarClock} title={a.title} hint={windowText(a, t, language)} />
                  ))}
                </ListSection>
              ) : null}
            </>
          )}
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] px-1">{t('einsatz.note-footer')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
