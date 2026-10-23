import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import ConsentsSection from '@/components/privacy/ConsentsSection';
import ClubNoticeCard from '@/components/privacy/ClubNoticeCard';
import DpaHintCard from '@/components/privacy/DpaHintCard';
import VisibilitySection from '@/components/privacy/VisibilitySection';
import DataRightsSection from '@/components/privacy/DataRightsSection';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyCenter'>;

/**
 * "Mein Datenschutz" (Wave 10 M4), reachable from Settings: the club's privacy notice, the own (voluntary) consents,
 * who may see which contact field, the own data (Art. 15), the erasure request with its deadline, and for the club
 * owner a read-only hint on the processor agreement. Everything is bound to the active club and the caller's own
 * membership; without a membership there is nothing to show but a note. Nothing personal is logged or stored.
 */
export default function PrivacyCenterScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { activeClub, loading: clubLoading, error: clubError, refetch } = useActiveClub();
  const clubId = activeClub?.clubId ?? null;
  const { membership, loading: membershipLoading, refetch: refetchMembership } = useOwnMembership(clubId);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('datenschutz.title')}
        </Text>
        {activeClub?.clubName ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-2" numberOfLines={1}>
            {activeClub.clubName}
          </Text>
        ) : null}
      </View>

      {clubLoading || (membershipLoading && !membership) ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : clubError ? (
        <View className="px-6 pt-4">
          <Text className="text-destructive text-sm mb-2">{t('datenschutz.load-error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void refetch()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : !clubId || !membership ? (
        <View className="px-6 pt-4">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('datenschutz.empty.title')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('datenschutz.empty.body')}</Text>
          {clubId ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => void refetchMembership()} className="min-h-[44px] justify-center self-start">
              <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('datenschutz.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView key={clubId} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }}>
          <DpaHintCard clubId={clubId} />
          <ClubNoticeCard clubId={clubId} />
          <ConsentsSection subject={{ kind: 'self', clubId, clubMemberId: membership.id }} />
          <VisibilitySection clubId={clubId} clubMemberId={membership.id} />
          <DataRightsSection clubId={clubId} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('datenschutz.account-hint')}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
