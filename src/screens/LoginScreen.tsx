import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import Button from '@/components/ui/Button';
import Banner from '@/components/ui/Banner';
import Title from '@/components/ui/Title';
import { Field, inputClassName } from '@/components/ui/FormSheet';
import { mapApiError } from '@/lib/mapApiError';
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
        setError(mapApiError(result, t, 'alert.general-error-description'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScreen
      className="bg-background dark:bg-background-dark"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
    >
        <View className="mb-8">
          <Logo />
          <View className="mt-6">
            <Title>{t('login.title')}</Title>
          </View>
          <Text className="text-[17px] leading-6 mt-2 text-muted-foreground dark:text-muted-foreground-dark">{t('login.description')}</Text>
        </View>

        <Field label={t('login.username')}>
          <TextInput
            className={inputClassName}
            placeholder="user@example.com"
            placeholderTextColor={themeColors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel={t('login.username')}
            value={email}
            onChangeText={setEmail}
          />
        </Field>

        <Field label={t('login.password')}>
          <TextInput
            className={inputClassName}
            placeholderTextColor={themeColors.mutedForeground}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel={t('login.password')}
            value={password}
            onChangeText={setPassword}
          />
        </Field>

        {error ? (
          <View className="mb-3">
            <Banner tone="danger" body={error} />
          </View>
        ) : null}

        <View className="mt-2" style={{ gap: 10 }}>
          <Button block label={t('login.button')} onPress={handleLogin} disabled={!email || !password} loading={isSubmitting} />
          <Button block variant="secondary" label={t('login.create.account')} onPress={() => onNavigateToSignup?.()} />
          <Button block variant="tertiary" label={t('login.forgot.password')} onPress={() => onForgotPassword?.()} />
        </View>
    </KeyboardAwareScreen>
  );
}
