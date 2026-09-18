import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import Logo from '@/components/Logo';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';

interface LoginScreenProps {
  onLogin?: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onNavigateToSignup?: () => void;
  onForgotPassword?: () => void;
}

export default function LoginScreen({ onLogin, onNavigateToSignup, onForgotPassword }: LoginScreenProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!onLogin || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onLogin(email, password);
      if (!result.success) {
        setError(result.error ?? t('alert.general-error-description'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScreen
      className="bg-muted dark:bg-muted-dark"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }}
    >
        <View className="items-center mb-6">
          <Logo />
        </View>

        <Text className="text-3xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark">
          {t('login.title')}
        </Text>
        <Text className="text-sm text-center mb-8 text-muted-foreground dark:text-muted-foreground-dark">
          {t('login.description')}
        </Text>

        <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('login.username')}
          </Text>
          <TextInput
            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-4"
            placeholder="user@example.com"
            placeholderTextColor={themeColors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('login.password')}
          </Text>
          <TextInput
            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-4"
            placeholder="********"
            placeholderTextColor={themeColors.mutedForeground}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}

          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center mt-1 ${isSubmitting ? 'opacity-70' : ''}`}
            onPress={handleLogin}
            disabled={isSubmitting || !email || !password}
          >
            {isSubmitting ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">
                {t('login.button')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="mt-3 items-center" onPress={onForgotPassword}>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm font-semibold">
              {t('login.forgot.password')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity className="mt-4 items-center" onPress={onNavigateToSignup}>
            <Text className="text-primary dark:text-primary-dark text-sm font-semibold">
              {t('login.create.account')}
            </Text>
          </TouchableOpacity>
        </View>
    </KeyboardAwareScreen>
  );
}
