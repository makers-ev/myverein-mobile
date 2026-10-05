import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useThemeColors } from '@/theme/colors';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import Logo from '@/components/Logo';
import SignedInCard from '@/components/SignedInCard';
import BentoTile from '@/components/ui/BentoTile';
import FadeIn from '@/components/ui/FadeIn';
import AcceptTosModal from '@/legal/AcceptTosModal';
import { hasAcceptedTos, setTosAccepted } from '@/legal/tosAcceptanceStorage';
import IntroModal from '@/onboarding/IntroModal';
import { hasSeenIntro, setIntroSeen } from '@/onboarding/introSeenStorage';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const FEATURES = {
  kalender: { icon: CalendarDays, route: 'Kalender' },
  standorte: { icon: MapPin, route: 'Standorte' },
  verein: { icon: Users, route: 'Verein' },
} as const;

export default function HomeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth();
  const colors = useThemeColors();

  const [tosModalVisible, setTosModalVisible] = useState(false);
  const [introModalVisible, setIntroModalVisible] = useState(false);

  // Intro only shows once ToS is out of the way -- never stack two blocking modals.
  const maybeShowIntro = () => {
    hasSeenIntro().then((seen) => {
      if (!seen) setIntroModalVisible(true);
    });
  };

  useEffect(() => {
    hasAcceptedTos().then((accepted) => {
      if (!accepted) setTosModalVisible(true);
      else maybeShowIntro();
    });
  }, []);

  const handleAcceptTos = () => {
    void setTosAccepted();
    setTosModalVisible(false);
    maybeShowIntro();
  };

  const handleCloseIntro = () => {
    void setIntroSeen(true);
    setIntroModalVisible(false);
  };

  const featureTile = (key: keyof typeof FEATURES, minHeight: number, delay: number) => {
    const { icon: Icon, route } = FEATURES[key];
    return (
      <FadeIn delay={delay}>
        <BentoTile
          minHeight={minHeight}
          accessibilityLabel={`${t(`home.feature.${key}.title`)}. ${t(`home.feature.${key}.body`)}`}
          onPress={() => requireAuth(() => navigation.navigate(route))}
        >
          <View className="bg-primary/10 dark:bg-primary-dark/10 rounded-xl p-2.5 self-start mb-3">
            <Icon size={22} color={colors.primary} />
          </View>
          <Text className="text-foreground dark:text-foreground-dark font-bold">{t(`home.feature.${key}.title`)}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-1">{t(`home.feature.${key}.body`)}</Text>
        </BentoTile>
      </FadeIn>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <AcceptTosModal visible={tosModalVisible} onAccept={handleAcceptTos} />
      <IntroModal visible={introModalVisible} onClose={handleCloseIntro} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="p-6" style={{ gap: 12 }}>
          <View className="mb-2">
            <Logo size={40} />
            <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-2xl font-extrabold mt-4">
              {t('home.hero-title')}
            </Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark mt-1">{t('home.hero-subtitle')}</Text>
          </View>

          {isAuthenticated ? (
            <SignedInCard onOpenSettings={() => navigation.navigate('Settings')} />
          ) : (
            <BentoTile emphasis minHeight={140}>
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-lg font-bold mb-1">
                {t('home.guest-heading')}
              </Text>
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm mb-4 opacity-90">
                {t('home.guest-body')}
              </Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('home.signup-cta')}
                  activeOpacity={0.7}
                  className="flex-1 min-h-[44px] justify-center bg-card dark:bg-card-dark rounded-xl"
                  onPress={() => navigation.navigate('Signup')}
                >
                  <Text className="text-primary dark:text-primary-dark text-center font-bold">{t('home.signup-cta')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('home.login-cta')}
                  activeOpacity={0.7}
                  className="flex-1 min-h-[44px] justify-center border border-primary-foreground dark:border-primary-foreground-dark rounded-xl"
                  onPress={() => navigation.navigate('Login', {})}
                >
                  <Text className="text-primary-foreground dark:text-primary-foreground-dark text-center font-bold">
                    {t('home.login-cta')}
                  </Text>
                </TouchableOpacity>
              </View>
            </BentoTile>
          )}

          {featureTile('kalender', 120, 0)}
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1">{featureTile('standorte', 168, 100)}</View>
            <View className="flex-1">{featureTile('verein', 168, 200)}</View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
