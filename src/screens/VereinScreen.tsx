import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/AppNavigator';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { navigate } from '@/navigation/navigationRef';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useClubRegistration } from '@/hooks/useClubRegistration';
import { useClubInfo } from '@/hooks/useClubInfo';
import { getDepartmentColor } from '@/theme/departmentColors';
import ProfilTab from '@/components/verein/ProfilTab';
import MembersTab from '@/components/verein/MembersTab';
import VerwaltungTab, { canSeeVerwaltung } from '@/components/verein/VerwaltungTab';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import NoClubChoices from '@/components/onboarding/NoClubChoices';
import TabChips from '@/components/ui/TabChips';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import ClubsLoadError from '@/components/verein/ClubsLoadError';
import ClubDocumentReader from '@/components/documents/ClubDocumentReader';
import ListRow from '@/components/ui/ListRow';
import { AcknowledgementsEntry, ArchiveEntry } from '@/components/documents/DocumentsEntry';
import { FileText, Landmark, Vote } from 'lucide-react-native';
import ListSection from '@/components/ui/ListSection';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import Title from '@/components/ui/Title';

type Tab = 'info' | 'mitglieder' | 'profil' | 'verwaltung';

function VereinsinfoTab({ clubId, clubName }: { clubId: string; clubName: string }) {
  const { t } = useLanguage();
  const { info, loading } = useClubInfo(clubId);
  // The document being read (slug + title from the list); the text itself is fetched by the reader per slug.
  const [reading, setReading] = useState<{ slug: string; title: string } | null>(null);

  if (loading || !info) {
    return <Skeleton shape="rows" lines={4} />;
  }

  return (
    <>
      {/* Club block: crest (accent soft) + serif name; the only hero moment of this tab. */}
      <View className="flex-row items-center mb-6" style={{ gap: 16 }}>
        <Avatar name={clubName} size="L" tone="accent" />
        <View className="flex-1">
          <Title size="M" header={false}>
            {clubName}
          </Title>
          {info.departments.length > 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-1">{t('verein.info.departments.count', { count: info.departments.length })}</Text>
          ) : null}
        </View>
      </View>

      <ListSection title={t('verein.info.board')}>
        {info.board.length === 0 ? (
          <ListRow key="none" title={t('verein.info.board.empty')} />
        ) : (
          info.board.map((m) => <ListRow key={m.memberId} title={m.name ?? '—'} trailing={<Badge tone="accent">{t(`verein.role.${m.roleType}`)}</Badge>} />)
        )}
      </ListSection>

      <ListSection title={t('verein.info.departments')} inset={40}>
        {info.departments.length === 0 ? (
          <ListRow key="none" title={t('verein.info.departments.empty')} />
        ) : (
          info.departments.map((d, i) => (
            <ListRow key={d.id} leading={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: getDepartmentColor(i) }} />} title={d.name} />
          ))
        )}
      </ListSection>

      <ListSection title={t('verein.info.pages')} inset={60}>
        {info.pages.length === 0 ? (
          <ListRow key="none" title={t('verein.info.pages.empty')} />
        ) : (
          info.pages.map((p) => {
            const openable = p.hasContent || p.hasAttachment || !!p.externalUrl;
            return (
              <ListRow
                key={p.id}
                icon={FileText}
                title={p.title}
                value={p.hasAttachment ? t('docs.reader.has-pdf') : undefined}
                accessibilityHint={openable ? t('docs.reader.open-hint', { title: p.title }) : undefined}
                onPress={openable ? () => setReading({ slug: p.slug, title: p.title }) : undefined}
              />
            );
          })
        )}
      </ListSection>

      <ListSection title={t('verein.section.take-part')} inset={60}>
        <AcknowledgementsEntry key="ack" clubId={clubId} />
        <ArchiveEntry key="archive" clubId={clubId} />
        <ListRow key="ballots" icon={Vote} title={t('assembly.dashboard.Abstimmungen')} onPress={() => navigate('Abstimmungen')} />
        <ListRow key="assembly" icon={Landmark} title={t('assembly.dashboard.Versammlung')} onPress={() => navigate('Versammlung')} />
      </ListSection>
      <ClubDocumentReader clubId={clubId} slug={reading?.slug ?? null} title={reading?.title ?? ''} onClose={() => setReading(null)} />
    </>
  );
}

function NoClubState() {
  const { t } = useLanguage();
  const { registration, refetch } = useClubRegistration();

  // Coming back from CreateClub: show the registration's newest status.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );

  return (
    <View className="px-6 pt-6">
      <NoClubChoices hideCreate={!!registration} />

      {registration ? (
        <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] p-4 mt-6">
          <Text className="text-[13px] font-medium mb-1 text-muted-foreground dark:text-muted-foreground-dark">
            {registration.clubName}
          </Text>
          <Text className="text-foreground dark:text-foreground-dark font-semibold text-base mb-1">
            {t(`create-club.status.${registration.status}.title`)}
          </Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">
            {t(`create-club.status.${registration.status}.body`)}
          </Text>
          <TouchableOpacity accessibilityRole="button"
            className="bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center self-start px-5"
            onPress={() => navigate('CreateClub')}
          >
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-semibold">
              {t(registration.status === 'draft' ? 'verein.no-club.registration.continue' : 'verein.no-club.registration.view')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default function VereinScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const route = useRoute<RouteProp<RootStackParamList, 'Verein'>>();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'info');
  // Unsaved inputs in the Profil tab: leaving the tab would drop them, so ask first.
  const [profileDirty, setProfileDirty] = useState(false);
  // Leaving via navigation (back, tab bar) while the profile has unsaved inputs.
  const navigation = useNavigation();
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!profileDirty) return;
      e.preventDefault();
      Alert.alert(t('profil.discard.title'), t('profil.discard.message'), [
        { text: t('profil.discard.keep'), style: 'cancel' },
        { text: t('profil.discard.confirm'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation, profileDirty, t]);
  // Club switch drops tab state, so ask first (the switcher only switches after proceed()).
  const guardClubSwitch = (proceed: () => void) => {
    if (!profileDirty) {
      proceed();
      return;
    }
    Alert.alert(t('profil.discard.title'), t('profil.discard.message'), [
      { text: t('profil.discard.keep'), style: 'cancel' },
      { text: t('profil.discard.confirm'), style: 'destructive', onPress: proceed },
    ]);
  };
  const selectTab = (value: Tab) => {
    if (value === tab) return;
    if (tab === 'profil' && profileDirty) {
      Alert.alert(t('profil.discard.title'), t('profil.discard.message'), [
        { text: t('profil.discard.keep'), style: 'cancel' },
        { text: t('profil.discard.confirm'), style: 'destructive', onPress: () => setTab(value) },
      ]);
      return;
    }
    setTab(value);
  };
  const { activeClub, error: clubsError, loading: clubsLoading, refetch: refetchClubs } = useMyClubs();
  // Role-dependent admin entry: only board roles with the matching permissions get the tab.
  const { can } = useOwnMembership(activeClub?.clubId ?? null);
  const showVerwaltung = canSeeVerwaltung(can);
  const tabs: Tab[] = showVerwaltung ? ['info', 'mitglieder', 'verwaltung', 'profil'] : ['info', 'mitglieder', 'profil'];
  const activeTab: Tab = tabs.includes(tab) ? tab : 'info';
  // Opened with a tab (Mehr > Mein Profil, Heute shortcuts), also when already mounted.
  const paramTab = route.params?.tab;
  useEffect(() => {
    if (paramTab) setTab(paramTab);
  }, [paramTab, route.params]);

  // Returning from CreateClub after an approval: reload the memberships so
  // the new club shows up (the hook instance here keeps its old state).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetchClubs();
    }, [refetchClubs]),
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScreenHeader title={t('nav.verein')} context={<ClubSwitcher onBeforeSwitch={guardClubSwitch} />} />

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primaryText} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !activeClub ? (
        <NoClubState />
      ) : (
        <>
          <TabChips tabs={tabs.map((value) => ({ value, label: t(`verein.tab.${value}`) }))} active={activeTab} onChange={selectTab} />

          <ScrollView key={activeClub.clubId} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}>
            {activeTab === 'info' && <VereinsinfoTab clubId={activeClub.clubId} clubName={activeClub.clubName ?? t('nav.verein')} />}
            {activeTab === 'mitglieder' && <MembersTab clubId={activeClub.clubId} memberId={route.params?.memberId} />}
            {activeTab === 'verwaltung' && <VerwaltungTab clubId={activeClub.clubId} onOpenMembers={() => selectTab('mitglieder')} />}
            {activeTab === 'profil' && <ProfilTab clubId={activeClub.clubId} onDirtyChange={setProfileDirty} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
