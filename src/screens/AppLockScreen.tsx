import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Delete, Lock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useAttemptLockout } from '@/hooks/useAttemptLockout';
import { useThemeColors } from '@/theme/colors';
import Title from '@/components/ui/Title';
import PressScale from '@/components/ui/PressScale';

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

  const press = (digit: string) => {
    if (isLocked || inputPin.length >= 4) return;
    handleChangeText(inputPin + digit);
  };
  const backspace = () => {
    if (!isLocked) setInputPin((v) => v.slice(0, -1));
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1 items-center px-8" style={{ paddingTop: 72 }}>
        <View className="w-16 h-16 rounded-full items-center justify-center mb-5 bg-primary-soft dark:bg-primary-soft-dark">
          <Lock size={30} strokeWidth={1.75} color={themeColors.primaryText} />
        </View>
        <Title className="text-foreground dark:text-foreground-dark mb-2 text-center">{t('app-lock.title')}</Title>
        <Text className="text-[15px] leading-[22px] text-muted-foreground dark:text-muted-foreground-dark text-center">
          {t('app-lock.description')}
        </Text>

        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('app-lock.digits', { count: inputPin.length })}
          className="flex-row mt-7 mb-3"
          style={{ gap: 14, opacity: isLocked ? 0.5 : 1 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              className={`w-[18px] h-[18px] rounded-full border-2 border-primary dark:border-primary-dark ${i < inputPin.length ? 'bg-primary dark:bg-primary-dark' : ''}`}
            />
          ))}
        </View>

        <Text
          accessibilityLiveRegion="polite"
          className={`text-[13px] leading-[18px] ${isLocked ? 'text-destructive dark:text-destructive-dark font-semibold' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
        >
          {isLocked ? lockoutMessage : attemptsMessage}
        </Text>
      </View>

      <View className="bg-muted dark:bg-muted-dark px-2 pt-2.5 pb-4" style={{ gap: 8 }}>
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']].map((row, r) => (
          <View key={r} className="flex-row" style={{ gap: 8 }}>
            {row.map((k, c) =>
              k === '' ? (
                <View key={c} className="flex-1" />
              ) : (
                <PressScale
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={k === 'del' ? t('app-lock.delete') : k}
                  accessibilityState={{ disabled: isLocked }}
                  disabled={isLocked}
                  onPress={() => (k === 'del' ? backspace() : press(k))}
                  className={`flex-1 items-center justify-center rounded-control ${k === 'del' ? '' : 'bg-card dark:bg-card-dark border border-border-control dark:border-border-control-dark'}`}
                  style={{ minHeight: 56 }}
                >
                  {k === 'del' ? (
                    <Delete size={24} strokeWidth={1.75} color={themeColors.foreground} />
                  ) : (
                    <Text className="text-foreground dark:text-foreground-dark text-[26px]" style={{ fontVariant: ['tabular-nums'] }}>
                      {k}
                    </Text>
                  )}
                </PressScale>
              ),
            )}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
