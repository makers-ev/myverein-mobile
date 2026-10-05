import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { navigate } from '@/navigation/navigationRef';
import { useMyClubs } from '@/hooks/useMyClubs';
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
  const [tab, setTab] = useState<Tab>('orte');
  const { activeClub, loading: clubsLoading } = useMyClubs();

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {activeClub?.clubName ?? t('standorte.title')}
        </Text>
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub ? (
        // Same "no club" copy/UX as VereinScreen -- a member with no club
        // shouldn't see a different empty state per screen.
        <View className="px-6 pt-6">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('verein.no-club.title')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{t('verein.no-club.body')}</Text>
          <TouchableOpacity
            className="bg-primary dark:bg-primary-dark rounded-lg py-3 items-center self-start px-5"
            onPress={() => navigate('JoinClub')}
          >
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
              {t('verein.no-club.join')}
            </Text>
          </TouchableOpacity>
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

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
            {tab === 'orte' && <OrteTab clubId={activeClub.clubId} />}
            {tab === 'material' && <MaterialTab clubId={activeClub.clubId} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
