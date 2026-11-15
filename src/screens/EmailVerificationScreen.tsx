import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mapApiError } from '@/lib/mapApiError';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import Title from '@/components/ui/Title';
import Button from '@/components/ui/Button';

interface EmailVerificationScreenProps {
  email: string;
  onResend: () => Promise<{ success: boolean; error?: string }>;
  onBackToLogin: () => void;
}

export default function EmailVerificationScreen({ email, onResend, onBackToLogin }: EmailVerificationScreenProps) {
  const { t } = useLanguage();
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
        setError(mapApiError(result, t, 'email-verification.resend-error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-muted dark:bg-muted-dark">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <Title className="text-foreground dark:text-foreground-dark text-center mb-2">
          {t('email-verification.title')}
        </Title>
        <Text className="text-sm text-center mb-8 text-muted-foreground dark:text-muted-foreground-dark">
          {t('email-verification.description')}
        </Text>

        <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
          <Text className="text-base font-semibold text-center mb-4 text-foreground dark:text-foreground-dark">
            {email}
          </Text>

          {sent ? (
            <Text className="text-primary dark:text-primary-dark text-sm mb-3 text-center">
              {t('email-verification.resent')}
            </Text>
          ) : null}
          {error ? <Text className="text-destructive dark:text-destructive-dark text-sm mb-3 text-center">{error}</Text> : null}

          <Button block label={t('email-verification.resend')} onPress={handleResend} loading={isSubmitting} />

          <TouchableOpacity accessibilityRole="button" className="mt-4 items-center" onPress={onBackToLogin}>
            <Text className="text-primary dark:text-primary-dark text-sm font-semibold">
              {t('email-verification.back-to-login')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
