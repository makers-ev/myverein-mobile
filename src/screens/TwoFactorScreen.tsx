import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useAttemptLockout } from '@/hooks/useAttemptLockout';
import { useThemeColors } from '@/theme/colors';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';

interface TwoFactorScreenProps {
  onVerify?: (code: string) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
}

export default function TwoFactorScreen({ onVerify, onCancel }: TwoFactorScreenProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side brute-force mitigation: after repeated wrong codes, lock
  // out further submit attempts for a cooldown period instead of allowing
  // unlimited instant retries.
  const {
    isLocked,
    remainingSeconds,
    attemptsRemaining,
    registerFailure,
    registerSuccess,
  } = useAttemptLockout();

  const handleVerify = async () => {
    if (!onVerify || isSubmitting || isLocked || code.length === 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onVerify(code);
      if (result.success) {
        registerSuccess();
      } else {
        registerFailure();
        setError(result.error ?? t('alert.general-error-description'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const lockoutMessage = t('lockout.too-many-attempts').replace(
    '{seconds}',
    String(remainingSeconds)
  );
  const attemptsMessage = t('lockout.attempts-remaining').replace(
    '{count}',
    String(attemptsRemaining)
  );

  return (
    <KeyboardAwareScreen
      className="bg-muted dark:bg-muted-dark"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }}
    >
        <Text className="text-2xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark">
          {t('twofactor.title')}
        </Text>
        <Text className="text-sm text-center mb-8 text-muted-foreground dark:text-muted-foreground-dark">
          {t('twofactor.description')}
        </Text>

        <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
          <TextInput
            className="bg-muted dark:bg-muted-dark rounded-lg p-3.5 text-2xl tracking-[8px] text-center text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-4"
            placeholder={t('twofactor.placeholder')}
            placeholderTextColor={themeColors.mutedForeground}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            editable={!isLocked}
            value={code}
            onChangeText={setCode}
          />

          {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}

          {isLocked ? (
            <Text className="text-destructive text-xs font-semibold mb-3 text-center">{lockoutMessage}</Text>
          ) : (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3 text-center">{attemptsMessage}</Text>
          )}

          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center mt-1 ${(isSubmitting || isLocked) ? 'opacity-70' : ''}`}
            onPress={handleVerify}
            disabled={isSubmitting || isLocked || code.length === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">
                {t('twofactor.button')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="mt-4 items-center" onPress={onCancel}>
            <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('twofactor.cancel')}</Text>
          </TouchableOpacity>
        </View>
    </KeyboardAwareScreen>
  );
}
