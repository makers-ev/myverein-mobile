import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import AssemblyDetailView from '@/components/assembly/AssemblyDetailView';
import BallotDetailView from '@/components/assembly/BallotDetailView';
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
  useEffect(() => {
    if (pushReady || pushGone) consumePush();
  }, [pushReady, pushGone, consumePush]);
  const switching = !!push.target && !pushReady && !pushGone;
  const { meetings, loading, error, refetch } = useMeetings(clubId);
  const [meetingId, setMeetingId] = useState<string | null>(route.params?.meetingId ?? null);
  const [ballotId, setBallotId] = useState<string | null>(null);
  const [lastParam, setLastParam] = useState(route.params?.meetingId);
  if (route.params?.meetingId !== lastParam) {
    setLastParam(route.params?.meetingId);
    if (route.params?.meetingId) {
      setMeetingId(route.params.meetingId);
      setBallotId(null);
    }
  }

  const list = meetings.filter(isAssemblyMeeting).sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''));

  let body: React.ReactNode;
  if (clubLoading || switching || (loading && meetings.length === 0)) body = <Loading />;
  else if (!clubId) body = <Card><Body>{t('assembly.no-club')}</Body></Card>;
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
              className="min-h-[64px] bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-3"
            >
              <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{m.title}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) : t('treffen.scheduled-at.pending')}</Text>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Abstimmungen')} className="min-h-[48px] justify-center self-start">
          <Text className="text-primary dark:text-primary-dark font-semibold">{t('assembly.to-ballots')}</Text>
        </TouchableOpacity>
      </>
    );

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 140 }}>
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('assembly.title')}
        </Text>
        {activeClub?.clubName ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{activeClub.clubName}</Text> : <View className="mb-4" />}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}
