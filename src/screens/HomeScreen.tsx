import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronRight, MapPin, Moon, ShieldCheck, Users, Eye } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useThemeColors } from '@/theme/colors';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import Logo from '@/components/Logo';
import AcceptTosModal from '@/legal/AcceptTosModal';
import { hasAcceptedTos, setTosAccepted } from '@/legal/tosAcceptanceStorage';
import IntroModal from '@/onboarding/IntroModal';
import { hasSeenIntro, setIntroSeen } from '@/onboarding/introSeenStorage';
import type { RootStackParamList } from '@/navigation/AppNavigator';

/** Fades + slides children in on mount; `delay` in ms staggers siblings. */
function FadeIn({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const CHIPS = [
  { key: 'roles', icon: ShieldCheck },
  { key: 'guest', icon: Eye },
  { key: 'dark', icon: Moon },
] as const;

const FEATURES = [
  { key: 'kalender', icon: CalendarDays, route: 'Kalender' },
  { key: 'standorte', icon: MapPin, route: 'Standorte' },
  { key: 'verein', icon: Users, route: 'Verein' },
] as const;

export default function HomeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
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

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <AcceptTosModal visible={tosModalVisible} onAccept={handleAcceptTos} />
      <IntroModal visible={introModalVisible} onClose={handleCloseIntro} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="p-6">
          <FadeIn>
          <View className="items-center mb-8 bg-primary/10 dark:bg-primary-dark/10 rounded-3xl px-6 py-8 overflow-hidden">
            <View className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/15 dark:bg-primary-dark/15" />
            <View className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-accent/15 dark:bg-accent-dark/15" />
            <Logo size={56} />
            <Text className="text-foreground dark:text-foreground-dark text-2xl font-extrabold text-center mt-5">
              {t('home.hero-title')}
            </Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-center mt-2">
              {t('home.hero-subtitle')}
            </Text>
            <View className="flex-row flex-wrap justify-center mt-5" style={{ gap: 8 }}>
              {CHIPS.map(({ key, icon: Icon }) => (
                <View key={key} className="flex-row items-center bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-full px-3 py-1.5" style={{ gap: 6 }}>
                  <Icon size={13} color={colors.primary} />
                  <Text className="text-foreground dark:text-foreground-dark text-xs font-medium">{t(`home.chip.${key}`)}</Text>
                </View>
              ))}
            </View>
          </View>
          </FadeIn>

          {isAuthenticated ? (
            <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-6">
              <Text className="text-foreground dark:text-foreground-dark text-base">
                {t('home.signed-in-as').replace('{email}', user?.email ?? '')}
              </Text>
              <TouchableOpacity className="mt-3" onPress={() => navigation.navigate('Settings')}>
                <Text className="text-primary dark:text-primary-dark font-semibold">
                  {t('home.go-to-settings')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-6">
              <Text className="text-foreground dark:text-foreground-dark text-base font-semibold mb-1">
                {t('home.guest-heading')}
              </Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">
                {t('home.guest-body')}
              </Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  className="flex-1 bg-primary dark:bg-primary-dark rounded-xl py-3"
                  onPress={() => navigation.navigate('Signup')}
                >
                  <Text className="text-primary-foreground dark:text-primary-foreground-dark text-center font-bold">
                    {t('home.signup-cta')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 border border-border dark:border-border-dark rounded-xl py-3"
                  onPress={() => navigation.navigate('Login', {})}
                >
                  <Text className="text-foreground dark:text-foreground-dark text-center font-bold">
                    {t('home.login-cta')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text className="text-foreground dark:text-foreground-dark text-lg font-bold mb-3">
            {t('home.features-heading')}
          </Text>

          {FEATURES.map(({ key, icon: Icon, route }, i) => (
            <FadeIn key={key} delay={200 + i * 120}>
            <TouchableOpacity
              className="flex-row items-center bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-3"
              style={{ gap: 14 }}
              onPress={() => requireAuth(() => navigation.navigate(route))}
            >
              <View className="bg-primary/10 dark:bg-primary-dark/10 rounded-xl p-3">
                <Icon size={22} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground dark:text-foreground-dark font-semibold">{t(`home.feature.${key}.title`)}</Text>
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-0.5">{t(`home.feature.${key}.body`)}</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            </FadeIn>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
