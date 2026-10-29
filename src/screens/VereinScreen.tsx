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
import { useClubInfo, type BoardMember, type Department } from '@/hooks/useClubInfo';
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
import { FileText } from 'lucide-react-native';

type Tab = 'info' | 'mitglieder' | 'profil' | 'verwaltung';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{title}</Text>
      {children}
    </View>
  );
}

// `last:` isn't reliable in NativeWind/React Native (no real DOM for a
// structural `:last-child` match) -- rows take an explicit `isLast` prop
// instead of relying on a CSS pseudo-class.
function BoardRow({ member, isLast }: { member: BoardMember; isLast: boolean }) {
  const { t } = useLanguage();
  return (
    <View className={`flex-row items-center justify-between py-2 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}>
      <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">{member.name ?? '—'}</Text>
      <View className="bg-primary/10 dark:bg-primary-dark/10 px-2.5 py-1 rounded-full">
        <Text className="text-primary dark:text-primary-dark text-xs font-semibold">
          {t(`verein.role.${member.roleType}`)}
        </Text>
      </View>
    </View>
  );
}

function DepartmentRow({ department, colorIndex, isLast }: { department: Department; colorIndex: number; isLast: boolean }) {
  const color = getDepartmentColor(colorIndex);
  return (
    <View className={`flex-row items-center py-2 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`} style={{ gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text className="text-foreground dark:text-foreground-dark text-sm">{department.name}</Text>
    </View>
  );
}

function VereinsinfoTab({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { info, loading } = useClubInfo(clubId);
  // The document being read (slug + title from the list); the text itself is fetched by the reader per slug.
  const [reading, setReading] = useState<{ slug: string; title: string } | null>(null);

  if (loading || !info) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      <SectionCard title={t('verein.info.board')}>
        {info.board.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.info.board.empty')}</Text>
        ) : (
          info.board.map((m, i) => <BoardRow key={m.memberId} member={m} isLast={i === info.board.length - 1} />)
        )}
      </SectionCard>

      <SectionCard title={t('verein.info.departments')}>
        {info.departments.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.info.departments.empty')}</Text>
        ) : (
          info.departments.map((d, i) => (
            <DepartmentRow key={d.id} department={d} colorIndex={i} isLast={i === info.departments.length - 1} />
          ))
        )}
      </SectionCard>

      <SectionCard title={t('verein.info.pages')}>
        {info.pages.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.info.pages.empty')}</Text>
        ) : (
          info.pages.map((p, i) => {
            const openable = p.hasContent || p.hasAttachment || !!p.externalUrl;
            return (
              <TouchableOpacity
                key={p.id}
                disabled={!openable}
                onPress={() => setReading({ slug: p.slug, title: p.title })}
                accessibilityRole="button"
                accessibilityLabel={p.title}
                accessibilityHint={t('docs.reader.open-hint', { title: p.title })}
                className={`flex-row items-center py-2 ${i === info.pages.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}
                style={{ minHeight: 44, gap: 10 }}
              >
                <FileText size={18} color={themeColors.primary} />
                <Text className="text-foreground dark:text-foreground-dark text-sm font-medium flex-1">{p.title}</Text>
                {p.hasAttachment ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{t('docs.reader.has-pdf')}</Text> : null}
              </TouchableOpacity>
            );
          })
        )}
      </SectionCard>
      <AcknowledgementsEntry clubId={clubId} />
      <ArchiveEntry clubId={clubId} />
      <ListRow title={t('assembly.dashboard.Abstimmungen')} onPress={() => navigate('Abstimmungen')} />
      <ListRow title={t('assembly.dashboard.Versammlung')} onPress={() => navigate('Versammlung')} />
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
        <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mt-6">
          <Text className="text-xs font-semibold uppercase mb-1 text-muted-foreground dark:text-muted-foreground-dark">
            {registration.clubName}
          </Text>
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">
            {t(`create-club.status.${registration.status}.title`)}
          </Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">
            {t(`create-club.status.${registration.status}.body`)}
          </Text>
          <TouchableOpacity accessibilityRole="button"
            className="bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center self-start px-5"
            onPress={() => navigate('CreateClub')}
          >
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
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
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {activeClub?.clubName ?? t('nav.verein')}
        </Text>
        <ClubSwitcher onBeforeSwitch={guardClubSwitch} />
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !activeClub ? (
        <NoClubState />
      ) : (
        <>
          <View className="px-6 pt-3">
            <TabChips tabs={tabs.map((value) => ({ value, label: t(`verein.tab.${value}`) }))} active={activeTab} onChange={selectTab} />
          </View>

          <ScrollView key={activeClub.clubId} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
            {activeTab === 'info' && <VereinsinfoTab clubId={activeClub.clubId} />}
            {activeTab === 'mitglieder' && <MembersTab clubId={activeClub.clubId} memberId={route.params?.memberId} />}
            {activeTab === 'verwaltung' && <VerwaltungTab clubId={activeClub.clubId} onOpenMembers={() => selectTab('mitglieder')} />}
            {activeTab === 'profil' && <ProfilTab clubId={activeClub.clubId} onDirtyChange={setProfileDirty} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
