import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

interface EmailVerificationScreenProps {
  email: string;
  onResend: () => Promise<{ success: boolean; error?: string }>;
  onBackToLogin: () => void;
}

export default function EmailVerificationScreen({ email, onResend, onBackToLogin }: EmailVerificationScreenProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    if (isSubmitting) return;
    setSent(false);
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onResend();
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error ?? t('email-verification.resend-error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-muted dark:bg-muted-dark">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark">
          {t('email-verification.title')}
        </Text>
        <Text className="text-sm text-center mb-8 text-muted-foreground dark:text-muted-foreground-dark">
          {t('email-verification.description')}
        </Text>

        <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
          <Text className="text-base font-bold text-center mb-4 text-foreground dark:text-foreground-dark">
            {email}
          </Text>

          {sent ? (
            <Text className="text-primary dark:text-primary-dark text-sm mb-3 text-center">
              {t('email-verification.resent')}
            </Text>
          ) : null}
          {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}

          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center mt-1 ${isSubmitting ? 'opacity-70' : ''}`}
            onPress={handleResend}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">
                {t('email-verification.resend')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="mt-4 items-center" onPress={onBackToLogin}>
            <Text className="text-primary dark:text-primary-dark text-sm font-semibold">
              {t('email-verification.back-to-login')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
