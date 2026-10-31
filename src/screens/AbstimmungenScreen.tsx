import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import BallotDetailView from '@/components/assembly/BallotDetailView';
import BallotListView from '@/components/assembly/BallotListView';
import { Body, Card, Loading } from '@/components/assembly/ui';
import { usePushScreenTarget } from '@/notifications/usePushScreenTarget';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Abstimmungen'>;

/**
 * "Abstimmungen" (Wave 11 M1): the club's votes and elections, voting in three taps, results. Opened from the Dashboard or
 * by a deep link with `ballotId`. Every member with an account uses it; what a person may do is decided by the backend
 * (voter roll, check-in), so there is no permission gate here.
 */
export default function AbstimmungenScreen({ route }: Props) {
  const { t } = useLanguage();
  const { activeClub, loading } = useActiveClub();
  const clubId = activeClub?.clubId ?? null;
  // A tapped push may belong to another club: switch to it first, then drop the hand-over (the id arrives as a route param).
  const push = usePushScreenTarget('Abstimmungen');
  const { ready: pushReady, unreachable: pushGone, consume: consumePush } = push;
  const [goneNotice, setGoneNotice] = useState(false);
  useEffect(() => {
    if (pushGone) setGoneNotice(true);
    else if (pushReady) setGoneNotice(false);
    if (pushReady || pushGone) consumePush();
  }, [pushReady, pushGone, consumePush]);
  const switching = !!push.target && !pushReady && !pushGone;
  const [selected, setSelected] = useState<string | null>(route.params?.ballotId ?? null);
  const [lastParams, setLastParams] = useState(route.params);
  // A new deep link while the screen is open (second push tap) switches to that ballot.
  // Compared by object identity: tapping a push for the same id again navigates with a new params object and re-selects it.
  if (route.params !== lastParams) {
    setLastParams(route.params);
    if (route.params?.ballotId) setSelected(route.params.ballotId);
  }

  // Android back from a detail goes to the list, not out of the screen.
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!selected) return false;
        setSelected(null);
        return true;
      });
      return () => sub.remove();
    }, [selected]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 140 }}>
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('assembly.ballots.title')}
        </Text>
        {activeClub?.clubName ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{activeClub.clubName}</Text> : <View className="mb-4" />}
        {loading || switching ? (
          <Loading />
        ) : !clubId ? (
          <Card>
            <Body>{t('assembly.no-club')}</Body>
          </Card>
        ) : goneNotice ? (
          <Card>
            <Body>{t('push.notice.club-gone')}</Body>
          </Card>
        ) : selected ? (
          <BallotDetailView key={`${clubId}:${selected}`} clubId={clubId} ballotId={selected} onBack={() => setSelected(null)} />
        ) : (
          <BallotListView key={clubId} clubId={clubId} onSelect={setSelected} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
