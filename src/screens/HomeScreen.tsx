import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import Logo from '@/components/Logo';
import SignedInCard from '@/components/SignedInCard';
import Button from '@/components/ui/Button';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import Title from '@/components/ui/Title';
import FadeIn from '@/components/ui/FadeIn';
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

  const featureRow = (key: keyof typeof FEATURES) => {
    const { icon, route } = FEATURES[key];
    return (
      <ListRow
        key={key}
        icon={icon}
        title={t(`home.feature.${key}.title`)}
        hint={t(`home.feature.${key}.body`)}
        onPress={() => requireAuth(() => navigation.navigate(route))}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-4 pt-6">
          <FadeIn>
            <Logo size={44} />
            <View className="mt-6">
              <Title>{t('home.hero-title')}</Title>
            </View>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[17px] leading-6 mt-2">{t('home.hero-subtitle')}</Text>
          </FadeIn>

          <View className="mt-6 mb-6">
            {isAuthenticated ? (
              <SignedInCard onOpenSettings={() => navigation.navigate('Settings')} />
            ) : (
              // Browse first: the two account actions, and the list below stays open for looking around.
              <View style={{ gap: 10 }}>
                <Button block label={t('home.login-cta')} onPress={() => navigation.navigate('Login', {})} />
                <Button block variant="secondary" label={t('home.signup-cta')} onPress={() => navigation.navigate('Signup')} />
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] text-center mt-1">{t('home.guest-body')}</Text>
              </View>
            )}
          </View>

          <ListSection title={t('home.section.features')} inset={60}>
            {featureRow('kalender')}
            {featureRow('standorte')}
            {featureRow('verein')}
          </ListSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
