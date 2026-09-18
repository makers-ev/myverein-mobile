import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import Logo from '@/components/Logo';
import AcceptTosModal from '@/legal/AcceptTosModal';
import { hasAcceptedTos, setTosAccepted } from '@/legal/tosAcceptanceStorage';
import IntroModal from '@/onboarding/IntroModal';
import { hasSeenIntro, setIntroSeen } from '@/onboarding/introSeenStorage';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Placeholder only -- this is a generic auth template with no real product
// behind it yet. Kept deliberately generic ("Feature preview", "Explore
// what's possible") rather than inventing fake product features; a real
// app replaces this array (and the screen it links to) with its own.
const FEATURE_CARDS = [
  { title: 'Feature preview', description: 'A gated screen or action lives here once this template has a real product behind it.' },
  { title: 'Explore what’s possible', description: 'Another placeholder card -- swap these for your app’s actual features.' },
];

export default function HomeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();

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
          <View className="items-center mb-8">
            <Logo size={56} />
          </View>

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

          {FEATURE_CARDS.map((card) => (
            <TouchableOpacity
              key={card.title}
              className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-3"
              // Settings isn't gated (see AppNavigator.tsx) -- language,
              // theme, App Lock, and legal apply to guests too -- so this
              // just navigates, no requireAuth() wall to get through first.
              onPress={() => navigation.navigate('Settings')}
            >
              <Text className="text-foreground dark:text-foreground-dark font-semibold mb-1">{card.title}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{card.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
