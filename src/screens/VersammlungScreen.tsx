import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import AssemblyDetailView from '@/components/assembly/AssemblyDetailView';
import BallotDetailView from '@/components/assembly/BallotDetailView';
import UiButton from '@/components/ui/Button';
import TermHint from '@/components/assembly/TermHint';
import { Body, Card, ErrorRetry, Loading } from '@/components/assembly/ui';
import { useMeetings } from '@/hooks/useMeetings';
import { isAssemblyMeeting } from '@/lib/assembly';
import { usePushScreenTarget } from '@/notifications/usePushScreenTarget';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Versammlung'>;

/**
 * "Versammlung" (Wave 11 M2-M4): general assemblies of the club, newest first. Detail with invitation, RSVP, proxy, quorum,
 * votes, minutes (and the check-in list for `assembly:manage`). Deep link: `meetingId`. Members of the club see only what the
 * backend lets them read; the screen itself needs just a session.
 */
export default function VersammlungScreen({ route, navigation }: Props) {
  const { t, language } = useLanguage();
  const { activeClub, loading: clubLoading } = useActiveClub();
  const clubId = activeClub?.clubId ?? null;
  // A tapped push may belong to another club: switch to it first, then drop the hand-over (the id arrives as a route param).
  const push = usePushScreenTarget('Versammlung');
  const { ready: pushReady, unreachable: pushGone, consume: consumePush } = push;
  const [goneNotice, setGoneNotice] = useState(false);
  useEffect(() => {
    if (pushGone) setGoneNotice(true);
    else if (pushReady) setGoneNotice(false);
    if (pushReady || pushGone) consumePush();
  }, [pushReady, pushGone, consumePush]);
  const switching = !!push.target && !pushReady && !pushGone;
  const { meetings, loading, error, refetch } = useMeetings(clubId);
  const [meetingId, setMeetingId] = useState<string | null>(route.params?.meetingId ?? null);
  const [ballotId, setBallotId] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState(route.params);
  // Compared by object identity: tapping a push for the same id again navigates with a new params object and re-selects it.
  if (route.params !== lastParams) {
    setLastParams(route.params);
    if (route.params?.meetingId) {
      setMeetingId(route.params.meetingId);
      setBallotId(null);
    }
  }

  const list = (Array.isArray(meetings) ? meetings : []).filter(isAssemblyMeeting).sort((a, b) => String(b.scheduledAt ?? '').localeCompare(String(a.scheduledAt ?? '')));

  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (ballotId) setBallotId(null);
        else if (meetingId) setMeetingId(null);
        else return false;
        return true;
      });
      return () => sub.remove();
    }, [ballotId, meetingId]),
  );

  let body: React.ReactNode;
  if (clubLoading || switching || (loading && meetings.length === 0)) body = <Loading />;
  else if (!clubId) body = <Card><Body>{t('assembly.no-club')}</Body></Card>;
  else if (goneNotice) body = <Card><Body>{t('push.notice.club-gone')}</Body></Card>;
  else if (ballotId) body = <BallotDetailView key={ballotId} clubId={clubId} ballotId={ballotId} onBack={() => setBallotId(null)} />;
  else if (meetingId) body = <AssemblyDetailView key={`${clubId}:${meetingId}`} clubId={clubId} meetingId={meetingId} onBack={() => setMeetingId(null)} onOpenBallot={setBallotId} />;
  else if (error && meetings.length === 0) body = <ErrorRetry message={t('assembly.meeting.error')} onRetry={() => void refetch()} />;
  else
    body = (
      <>
        <TermHint clubId={clubId} />
        {list.length === 0 ? (
          <Card>
            <Body>{t('assembly.meetings.empty')}</Body>
            <Body muted>{t('assembly.meetings.empty-hint')}</Body>
          </Card>
        ) : (
          list.map((m) => (
            <TouchableOpacity
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}, ${m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString(language) : t('treffen.scheduled-at.pending')}`}
              onPress={() => setMeetingId(m.id)}
              className="min-h-[64px] bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] p-4 mb-2"
            >
              <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold mb-1">{m.title}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]" style={{ fontVariant: ['tabular-nums'] }}>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) : t('treffen.scheduled-at.pending')}</Text>
            </TouchableOpacity>
          ))
        )}
        <View className="self-start mt-2" style={{ marginLeft: -12 }}>
          <UiButton variant="tertiary" label={t('assembly.to-ballots')} onPress={() => navigation.navigate('Abstimmungen')} />
        </View>
      </>
    );

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}>
        {/* The stack header names the screen; the club is the context line (no second large title). */}
        {activeClub?.clubName ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-4 px-1">{activeClub.clubName}</Text>
        ) : (
          <View className="mb-4" />
        )}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}
