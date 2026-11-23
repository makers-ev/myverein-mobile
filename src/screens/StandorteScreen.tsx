import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/AppNavigator';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMyClubs } from '@/hooks/useMyClubs';
import NoClubChoices from '@/components/onboarding/NoClubChoices';
import TabChips from '@/components/ui/TabChips';
import ScreenHeader from '@/components/ui/ScreenHeader';
import ClubSwitcher from '@/components/verein/ClubSwitcher';
import ClubsLoadError from '@/components/verein/ClubsLoadError';
import OrteTab from '@/components/standorte/OrteTab';
import MaterialTab from '@/components/standorte/MaterialTab';

type Tab = 'orte' | 'material';

/**
 * Two-tab "Standorte" center: "Orte" (locations, WiFi, links -- see `OrteTab.tsx`)
 * and "Material" (inventory, loans, damage reports -- see `MaterialTab.tsx`).
 * Management actions inside each tab are gated by `locations:write` / `inventory:write`.
 */
export default function StandorteScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const route = useRoute<RouteProp<RootStackParamList, 'Standorte'>>();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'orte');
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params]);
  const { activeClub, error: clubsError, loading: clubsLoading } = useMyClubs();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScreenHeader title={t('mehr.section.club')} context={activeClub ? <ClubSwitcher /> : undefined} />

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primaryText} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !activeClub ? (
        <View className="px-4 pt-6">
          <NoClubChoices />
        </View>
      ) : (
        <>
          <TabChips tabs={(['orte', 'material'] as const).map((value) => ({ value, label: t(`standorte.tab.${value}`) }))} active={tab} onChange={setTab} />

          <ScrollView key={activeClub.clubId} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}>
            {tab === 'orte' && <OrteTab clubId={activeClub.clubId} locationId={route.params?.locationId} />}
            {tab === 'material' && <MaterialTab clubId={activeClub.clubId} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
