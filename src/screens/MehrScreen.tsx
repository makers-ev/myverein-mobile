import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useWards } from '@/hooks/useWards';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import ListRow from '@/components/ui/ListRow';
import { MyCardEntry, MyDocumentsEntry } from '@/components/documents/DocumentsEntry';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Mehr'>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-2">
      <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-bold uppercase tracking-wider mb-2 mt-3">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * "Mehr" tab (Wave 14 N1): everything that is not an everyday destination, grouped in plain words. Places, equipment,
 * availability, personal documents, the membership card, profile, privacy, platform notices and settings. Guests see the
 * list too; an entry that needs an account asks them to sign in only when they tap it (browse first, see CLAUDE.md).
 */
export default function MehrScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { activeClub } = useActiveClub();
  const { guardianOnly } = useWards();
  const platformUnread = useUnreadNotificationCount();
  // Club entries: shown to guests (they sign in on tap) and members; hidden for signed-in accounts without a club.
  const showClub = !isAuthenticated || (!!activeClub && !guardianOnly);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 140 }}>
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('mehr.title')}
        </Text>

        {!isAuthenticated ? (
          <ListRow title={t('mehr.signin')} hint={t('mehr.signin.hint')} onPress={() => navigation.navigate('Login', {})} />
        ) : null}

        {showClub ? (
          <Section title={t('mehr.section.club')}>
            <ListRow title={t('mehr.orte')} hint={t('mehr.orte.hint')} onPress={() => requireAuth(() => navigation.navigate('Standorte', { tab: 'orte' }))} />
            <ListRow title={t('mehr.material')} hint={t('mehr.material.hint')} onPress={() => requireAuth(() => navigation.navigate('Standorte', { tab: 'material' }))} />
            <ListRow title={t('mehr.verfuegbarkeit')} hint={t('mehr.verfuegbarkeit.hint')} onPress={() => requireAuth(() => navigation.navigate('Kalender', { tab: 'verfuegbarkeit' }))} />
          </Section>
        ) : null}

        {isAuthenticated ? (
          <Section title={t('mehr.section.mine')}>
            <MyCardEntry />
            <MyDocumentsEntry />
          </Section>
        ) : null}

        <Section title={t('mehr.section.account')}>
          {isAuthenticated && activeClub && !guardianOnly ? (
            <ListRow title={t('mehr.profile')} hint={t('mehr.profile.hint')} onPress={() => navigation.navigate('Verein', { tab: 'profil' })} />
          ) : null}
          {isAuthenticated ? <ListRow title={t('mehr.privacy')} hint={t('mehr.privacy.hint')} onPress={() => navigation.navigate('PrivacyCenter')} /> : null}
          {isAuthenticated ? (
            <ListRow title={t('mehr.platform')} hint={t('mehr.platform.hint')} badge={platformUnread} onPress={() => navigation.navigate('Notifications')} />
          ) : null}
          <ListRow title={t('mehr.settings')} hint={t('mehr.settings.hint')} onPress={() => navigation.navigate('Settings')} />
        </Section>

        {isAuthenticated ? (
          <Section title={t('mehr.section.more')}>
            <ListRow title={t('mehr.join')} hint={t('mehr.join.hint')} onPress={() => navigation.navigate('JoinClub')} />
            {!activeClub || guardianOnly ? (
              <ListRow title={t('mehr.create')} hint={t('mehr.create.hint')} onPress={() => navigation.navigate('CreateClub')} />
            ) : null}
          </Section>
        ) : null}

        <Section title={t('mehr.section.legal')}>
          <ListRow title={t('mehr.legal.privacy')} onPress={() => navigation.navigate('PrivacyPolicy')} />
          <ListRow title={t('mehr.legal.imprint')} onPress={() => navigation.navigate('Imprint')} />
          <ListRow title={t('mehr.legal.terms')} onPress={() => navigation.navigate('TermsOfService')} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
