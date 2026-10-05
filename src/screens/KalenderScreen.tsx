import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMyClubs } from '@/hooks/useMyClubs';
import TermineTab from '@/components/kalender/TermineTab';
import VerfuegbarkeitTab from '@/components/kalender/VerfuegbarkeitTab';
import TreffenTab from '@/components/kalender/TreffenTab';

type Tab = 'termine' | 'verfuegbarkeit' | 'treffen';

/**
 * Wave 2 (Kalender/Verfügbarkeit/Treffen) lives behind ONE new nav entry
 * with three tabs, not three separate nav entries -- the floating navbar
 * pill only has room for a few items (see Navbar.tsx), same reasoning that
 * merged Wave 1's Vereinsinfo/Mitglieder/Profil into VereinScreen's tabs.
 */
export default function KalenderScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [tab, setTab] = useState<Tab>('termine');
  const { activeClub, loading: clubsLoading } = useMyClubs();

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">{t('nav.kalender')}</Text>
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub ? (
        <View className="px-6 pt-6">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('verein.no-club.title')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.no-club.body')}</Text>
        </View>
      ) : (
        <>
          <View className="px-6 pt-3">
            <View className="flex-row mb-4" style={{ gap: 8 }}>
              {(['termine', 'verfuegbarkeit', 'treffen'] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setTab(value)}
                  className={`px-4 py-2 rounded-full ${tab === value ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'}`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      tab === value
                        ? 'text-primary-foreground dark:text-primary-foreground-dark'
                        : 'text-muted-foreground dark:text-muted-foreground-dark'
                    }`}
                  >
                    {t(`kalender.tab.${value}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
            {tab === 'termine' && <TermineTab clubId={activeClub.clubId} />}
            {tab === 'verfuegbarkeit' && <VerfuegbarkeitTab clubId={activeClub.clubId} />}
            {tab === 'treffen' && <TreffenTab clubId={activeClub.clubId} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
