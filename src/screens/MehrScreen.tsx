import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bell,
  CalendarClock,
  Clock,
  FileText,
  CircleHelp,
  LogIn,
  MapPin,
  Package,
  Plus,
  Search,
  Settings,
  Shield,
  Timer,
  User,
  UserPlus,
  Users,
} from 'lucide-react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useWards } from '@/hooks/useWards';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { canSeeTeamHours, canTrackTime } from '@/lib/eventRights';
import { useThemeColors } from '@/theme/colors';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import ScreenHeader from '@/components/ui/ScreenHeader';
import ActionSheet from '@/components/ui/ActionSheet';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import { MyCardEntry, MyDocumentsEntry } from '@/components/documents/DocumentsEntry';
import TimeSheet from '@/components/kalender/TimeSheet';
import MyHoursSheet from '@/components/kalender/MyHoursSheet';
import TeamHoursSheet from '@/components/kalender/TeamHoursSheet';
import { openDocs } from '@/lib/docsUrl';
import { goToTab } from '@/navigation/navigationRef';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Mehr'>;
type HoursSheet = 'time' | 'my' | 'team' | null;

/**
 * "Mehr" tab (Wave 14 N1, "Vereinsheim" layout): a search field on top, then grouped inset lists instead of a stack of
 * cards -- Orte & Material, Meine Unterlagen (Ausweis, Dokumente, Zeiterfassung), Konto & App, Weitere Vereine,
 * Rechtliches. Guests see the list too; an entry that needs an account asks them to sign in only when they tap it
 * (browse first, see CLAUDE.md). Counts sit on the row they belong to (platform notices), never on the tab.
 */
export default function MehrScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { activeClub } = useActiveClub();
  const { guardianOnly } = useWards();
  const platformUnread = useUnreadNotificationCount();
  const clubId = isAuthenticated && activeClub && !guardianOnly ? activeClub.clubId : null;
  const { membership } = useOwnMembership(clubId);
  // Zeiterfassung (decision D3): the same three tools as the Kalender menu, each only for whom it applies.
  const trackTime = canTrackTime(membership);
  const myHours = trackTime || membership?.hasRate === true;
  const teamHours = canSeeTeamHours(membership);
  const [hoursMenu, setHoursMenu] = useState(false);
  const [hoursSheet, setHoursSheet] = useState<HoursSheet>(null);
  // Club entries: shown to guests (they sign in on tap) and members; hidden for signed-in accounts without a club.
  const showClub = !isAuthenticated || (!!activeClub && !guardianOnly);

  const hoursOptions = [
    ...(trackTime ? [{ key: 'time', icon: Timer, label: t('time.open'), hint: t('time.open.hint'), onPress: () => setHoursSheet('time') }] : []),
    ...(myHours ? [{ key: 'my', icon: Clock, label: t('time.my.open'), hint: t('time.my.hint'), onPress: () => setHoursSheet('my') }] : []),
    ...(teamHours ? [{ key: 'team', icon: Users, label: t('time.team.open'), hint: t('time.team.hint'), onPress: () => setHoursSheet('team') }] : []),
  ];
  const openHours = () => {
    if (hoursOptions.length === 1) hoursOptions[0]!.onPress();
    else setHoursMenu(true);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader title={t('mehr.title')} context={clubId ? <ClubSwitcher /> : undefined} />
        <View className="px-4">
          {clubId ? (
            // Looks like the search field of the Suche screen and opens it (one tap, keyboard comes up there).
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mehr.search.open')}
              accessibilityHint={t('search.placeholder')}
              onPress={() => navigation.navigate('Suche')}
              className="flex-row items-center bg-muted dark:bg-muted-dark rounded-[10px] px-3 mb-6"
              style={{ minHeight: 44, gap: 8 }}
            >
              <Search size={20} strokeWidth={1.75} color={colors.mutedForeground} />
              <Text className="flex-1 text-muted-foreground dark:text-muted-foreground-dark text-[17px]" numberOfLines={1}>
                {t('search.placeholder')}
              </Text>
            </Pressable>
          ) : null}

          {!isAuthenticated ? (
            <ListSection inset={60}>
              <ListRow icon={LogIn} title={t('mehr.signin')} hint={t('mehr.signin.hint')} onPress={() => navigation.navigate('Login', {})} />
            </ListSection>
          ) : null}

          {showClub ? (
            <ListSection title={t('mehr.section.club')} inset={60}>
              <ListRow key="orte" icon={MapPin} title={t('mehr.orte')} hint={t('mehr.orte.hint')} onPress={() => requireAuth(() => navigation.navigate('Standorte', { tab: 'orte' }))} />
              <ListRow key="material" icon={Package} title={t('mehr.material')} hint={t('mehr.material.hint')} onPress={() => requireAuth(() => navigation.navigate('Standorte', { tab: 'material' }))} />
              <ListRow
                key="avail"
                icon={CalendarClock}
                title={t('mehr.verfuegbarkeit')}
                hint={t('mehr.verfuegbarkeit.hint')}
                onPress={() => requireAuth(() => goToTab('Kalender', { tab: 'verfuegbarkeit' }))}
              />
            </ListSection>
          ) : null}

          {isAuthenticated ? (
            <ListSection title={t('mehr.section.mine')} inset={60}>
              <MyCardEntry key="card" />
              <MyDocumentsEntry key="docs" />
              {clubId && hoursOptions.length > 0 ? (
                <ListRow key="time" icon={Timer} title={t('mehr.time')} hint={hoursOptions.length === 1 ? hoursOptions[0]!.hint : t('mehr.time.hint')} onPress={openHours} />
              ) : null}
            </ListSection>
          ) : null}

          <ListSection title={t('mehr.section.account')} inset={60}>
            {isAuthenticated && activeClub && !guardianOnly ? (
              <ListRow key="profile" icon={User} title={t('mehr.profile')} hint={t('mehr.profile.hint')} onPress={() => goToTab('Verein', { tab: 'profil' })} />
            ) : null}
            {isAuthenticated ? <ListRow key="privacy" icon={Shield} title={t('mehr.privacy')} hint={t('mehr.privacy.hint')} onPress={() => navigation.navigate('PrivacyCenter')} /> : null}
            {isAuthenticated ? (
              <ListRow key="platform" icon={Bell} title={t('mehr.platform')} hint={t('mehr.platform.hint')} count={platformUnread} countTone="primary" onPress={() => navigation.navigate('Notifications')} />
            ) : null}
            <ListRow
              key="help"
              icon={CircleHelp}
              title={t('docs.help.title')}
              hint={t('docs.help.hint')}
              onPress={() => {
                void openDocs().then((ok) => {
                  if (!ok) Alert.alert(t('docs.open-error.title'), t('docs.open-error.message'));
                });
              }}
            />
            <ListRow key="settings" icon={Settings} title={t('mehr.settings')} hint={t('mehr.settings.hint')} onPress={() => navigation.navigate('Settings')} />
          </ListSection>

          {isAuthenticated ? (
            <ListSection title={t('mehr.section.more')} inset={60}>
              <ListRow key="join" icon={UserPlus} title={t('mehr.join')} hint={t('mehr.join.hint')} onPress={() => navigation.navigate('JoinClub')} />
              {!activeClub || guardianOnly ? <ListRow key="create" icon={Plus} title={t('mehr.create')} hint={t('mehr.create.hint')} onPress={() => navigation.navigate('CreateClub')} /> : null}
            </ListSection>
          ) : null}

          <ListSection title={t('mehr.section.legal')} inset={60}>
            <ListRow key="privacy-policy" icon={FileText} title={t('mehr.legal.privacy')} onPress={() => navigation.navigate('PrivacyPolicy')} />
            <ListRow key="imprint" icon={FileText} title={t('mehr.legal.imprint')} onPress={() => navigation.navigate('Imprint')} />
            <ListRow key="terms" icon={FileText} title={t('mehr.legal.terms')} onPress={() => navigation.navigate('TermsOfService')} />
          </ListSection>
        </View>
      </ScrollView>

      {clubId ? (
        <>
          <ActionSheet visible={hoursMenu} title={t('mehr.time')} onClose={() => setHoursMenu(false)} groups={[{ items: hoursOptions }]} />
          {trackTime ? <TimeSheet visible={hoursSheet === 'time'} onClose={() => setHoursSheet(null)} clubId={clubId} /> : null}
          {myHours ? <MyHoursSheet visible={hoursSheet === 'my'} onClose={() => setHoursSheet(null)} clubId={clubId} /> : null}
          {teamHours ? <TeamHoursSheet visible={hoursSheet === 'team'} onClose={() => setHoursSheet(null)} clubId={clubId} /> : null}
        </>
      ) : null}
    </SafeAreaView>
  );
}
