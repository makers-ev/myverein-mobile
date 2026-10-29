import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/AppNavigator';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { navigate } from '@/navigation/navigationRef';
import { useMyClubs } from '@/hooks/useMyClubs';
import NoClubChoices from '@/components/onboarding/NoClubChoices';
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
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {activeClub?.clubName ?? t('standorte.title')}
        </Text>
        <ClubSwitcher />
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !activeClub ? (
        <View className="px-6 pt-6">
          <NoClubChoices />
        </View>
      ) : (
        <>
          <View className="px-6 pt-3">
            <View className="flex-row mb-4" style={{ gap: 8 }}>
              {(['orte', 'material'] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setTab(value)}
                  className={`px-4 py-2 rounded-full ${tab === value ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'}`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      tab === value ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'
                    }`}
                  >
                    {t(`standorte.tab.${value}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView key={activeClub.clubId} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
            {tab === 'orte' && <OrteTab clubId={activeClub.clubId} />}
            {tab === 'material' && <MaterialTab clubId={activeClub.clubId} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
