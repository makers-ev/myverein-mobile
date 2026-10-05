import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronRight } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiFetch } from '@/lib/api';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useOwnMembership, type ClubPermission } from '@/hooks/useOwnMembership';
import type { CalendarEvent } from '@/hooks/useEvents';
import Logo from '@/components/Logo';
import SignedInCard from '@/components/SignedInCard';
import BentoTile from '@/components/ui/BentoTile';
import FadeIn from '@/components/ui/FadeIn';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const SHORTCUTS: { key: string; permission: ClubPermission; route: 'Verein' | 'Kalender' | 'Standorte' }[] = [
  { key: 'members', permission: 'members:write', route: 'Verein' },
  { key: 'calendars', permission: 'calendars:write', route: 'Kalender' },
  { key: 'locations', permission: 'locations:write', route: 'Standorte' },
  { key: 'inventory', permission: 'inventory:write', route: 'Standorte' },
];

const LOOKAHEAD_DAYS = 90;

/** Earliest event starting now or later within the lookahead window (`GET /events?clubId=&from=&to=`). */
function useNextEvent(clubId: string | null) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(!!clubId);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setEvent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const from = new Date();
      const to = new Date(from.getTime() + LOOKAHEAD_DAYS * 86400000);
      const params = new URLSearchParams({ clubId, from: from.toISOString(), to: to.toISOString() });
      const { data } = await apiFetch<{ data: CalendarEvent[] }>(`/events?${params.toString()}`);
      const now = from.toISOString();
      const upcoming = data.filter((e) => e.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      setEvent(upcoming[0] ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { event, loading, error, refetch };
}

function Skeleton({ className = '' }: { className?: string }) {
  return <View className={`bg-muted dark:bg-muted-dark rounded-lg ${className}`} />;
}

export default function DashboardScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const { activeClub, loading: clubsLoading } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { event, loading: eventLoading, error, refetch } = useNextEvent(clubId);
  const { can } = useOwnMembership(clubId);
  const shortcuts = SHORTCUTS.filter((s) => can(s.permission));

  const loading = clubsLoading || eventLoading;
  const eventLabel = t('dashboard.next-event.title');

  let eventBody: React.ReactNode;
  if (loading) {
    eventBody = (
      <View style={{ gap: 8 }}>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </View>
    );
  } else if (error) {
    eventBody = (
      <View>
        <Text className="text-destructive text-sm">{t('dashboard.next-event.error')}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('connection.retry')}
          onPress={() => void refetch()}
          className="min-h-[44px] justify-center self-start"
        >
          <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (!activeClub) {
    eventBody = <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('dashboard.no-club')}</Text>;
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

  // Tapping the tile is only useful when there is a club calendar to open and no pending retry.
  const canOpenCalendar = !!activeClub && !error;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="p-6" style={{ gap: 12 }}>
          <View className="mb-2">
            <Logo size={40} />
            <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-2xl font-extrabold mt-4">
              {activeClub?.clubName ?? t('dashboard.title')}
            </Text>
          </View>

          <SignedInCard onOpenSettings={() => navigation.navigate('Settings')} />

          <FadeIn>
            <BentoTile
              minHeight={120}
              onPress={canOpenCalendar ? () => navigation.navigate('Kalender') : undefined}
              accessibilityLabel={eventLabel}
            >
              <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
                <CalendarDays size={18} color={colors.primary} />
                <Text className="flex-1 text-primary dark:text-primary-dark text-xs font-bold uppercase tracking-wider">{eventLabel}</Text>
                {canOpenCalendar ? <ChevronRight size={18} color={colors.mutedForeground} /> : null}
              </View>
              {eventBody}
            </BentoTile>
          </FadeIn>

          {shortcuts.length > 0 ? (
            <FadeIn delay={100}>
              <BentoTile minHeight={88}>
                <Text className="text-primary dark:text-primary-dark text-xs font-bold uppercase tracking-wider mb-3">
                  {t('dashboard.board.title')}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {shortcuts.map((s) => (
                    <TouchableOpacity
                      key={s.key}
                      accessibilityRole="button"
                      accessibilityLabel={t(`dashboard.board.${s.key}`)}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate(s.route)}
                      className="min-h-[44px] justify-center bg-muted dark:bg-muted-dark rounded-xl px-4"
                    >
                      <Text className="text-foreground dark:text-foreground-dark font-semibold text-sm">{t(`dashboard.board.${s.key}`)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </BentoTile>
            </FadeIn>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
