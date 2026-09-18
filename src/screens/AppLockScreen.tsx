import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useAttemptLockout } from '@/hooks/useAttemptLockout';
import { useThemeColors } from '@/theme/colors';

interface AppLockScreenProps {
  pin: string;
  onUnlock: () => void;
}

/**
 * Full-screen "enter PIN to continue" gate shown on app launch/foreground
 * whenever an App Lock PIN has been configured in Settings. Mirrors the
 * brute-force mitigation used by VerifyPinModal (attempt counter + temporary
 * lockout) since this is the actual enforcement point for the App Lock
 * feature -- unlike the Settings toggle, this screen blocks real access.
 */
export default function AppLockScreen({ pin, onUnlock }: AppLockScreenProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [inputPin, setInputPin] = useState('');
  const { isLocked, remainingSeconds, attemptsRemaining, registerFailure, registerSuccess } =
    useAttemptLockout();

  // Evaluated directly in the change handler (rather than a useEffect keyed
  // on `inputPin`) so the 4th digit is checked as part of the same update
  // that typed it, not a separate reactive pass.
  const handleChangeText = (value: string) => {
    setInputPin(value);
    if (isLocked || value.length !== 4) return;

    if (value === pin) {
      registerSuccess();
      setInputPin('');
      onUnlock();
    } else {
      registerFailure();
      setInputPin('');
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
    <SafeAreaView className="flex-1 bg-muted dark:bg-muted-dark">
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-2xl font-extrabold mb-2 text-foreground dark:text-foreground-dark">
          {t('app-lock.title')}
        </Text>
        <Text className="text-sm mb-8 text-muted-foreground dark:text-muted-foreground-dark text-center">
          {t('app-lock.description')}
        </Text>

        <TextInput
          className={`bg-card dark:bg-card-dark rounded-lg p-3.5 text-2xl tracking-[8px] text-center w-40 border border-border dark:border-border-dark text-foreground dark:text-foreground-dark ${isLocked ? 'opacity-50' : ''}`}
          keyboardType="numeric"
          maxLength={4}
          secureTextEntry
          editable={!isLocked}
          value={inputPin}
          onChangeText={handleChangeText}
          placeholder="****"
          placeholderTextColor={themeColors.mutedForeground}
          autoFocus
        />

        <Text className={`mt-3 text-xs ${isLocked ? 'text-destructive font-semibold' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}>
          {isLocked ? lockoutMessage : attemptsMessage}
        </Text>
      </View>
    </SafeAreaView>
  );
}
