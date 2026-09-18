import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import Logo from '@/components/Logo';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

// Placeholder landing screen for already-authenticated users -- a real
// product replaces this whole screen (and its content) with its actual
// dashboard/home experience once there is one.
export default function DashboardScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="p-6">
          <View className="items-center mb-8">
            <Logo size={56} />
          </View>

          <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-6">
            <Text className="text-foreground dark:text-foreground-dark text-base">
              {t('dashboard.signed-in-as').replace('{email}', user?.email ?? '')}
            </Text>
            <TouchableOpacity className="mt-3" onPress={() => navigation.navigate('Settings')}>
              <Text className="text-primary dark:text-primary-dark font-semibold">
                {t('home.go-to-settings')}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4">
            <Text className="text-foreground dark:text-foreground-dark font-semibold mb-1">
              {t('dashboard.placeholder-title')}
            </Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
              {t('dashboard.placeholder-body')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
