import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import Logo from '@/components/Logo';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';

interface ForgotPasswordScreenProps {
  onSubmit?: (email: string) => Promise<{ success: boolean; error?: string }>;
  onBackToLogin?: () => void;
}

export default function ForgotPasswordScreen({ onSubmit, onBackToLogin }: ForgotPasswordScreenProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!onSubmit || isSubmitting || !email) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onSubmit(email);
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error ?? t('forgot-password.error'));
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
        {t('forgot-password.title')}
      </Text>
      <Text className="text-sm text-center mb-8 text-muted-foreground dark:text-muted-foreground-dark">
        {t('forgot-password.description')}
      </Text>

      <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
        {sent ? (
          <>
            <Text className="text-base font-bold text-center mb-4 text-foreground dark:text-foreground-dark">
              {email}
            </Text>
            <Text className="text-primary dark:text-primary-dark text-sm mb-3 text-center">
              {t('forgot-password.sent')}
            </Text>
            <TouchableOpacity className="mt-4 items-center" onPress={onBackToLogin}>
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">
                {t('forgot-password.back-to-login')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
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

            {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}

            <TouchableOpacity
              className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center mt-1 ${isSubmitting ? 'opacity-70' : ''}`}
              onPress={handleSubmit}
              disabled={isSubmitting || !email}
            >
              {isSubmitting ? (
                <ActivityIndicator color={themeColors.primaryForeground} />
              ) : (
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">
                  {t('forgot-password.button')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity className="mt-4 items-center" onPress={onBackToLogin}>
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">
                {t('forgot-password.back-to-login')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAwareScreen>
  );
}