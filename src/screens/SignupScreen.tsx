import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Mail, Lock } from 'lucide-react-native';
import { mapApiError } from '@/lib/mapApiError';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import Logo from '@/components/Logo';
import Button from '@/components/ui/Button';
import Banner from '@/components/ui/Banner';
import Title from '@/components/ui/Title';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';

// Type declarations for lucide-react-native icons
const IconMail = Mail as any;
const IconLock = Lock as any;

interface SignupFormData {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}

interface SignupScreenProps {
  onSubmit?: (formData: SignupFormData) => Promise<{ success: boolean; error?: string; code?: string; status?: number }>;
  onNavigateToLogin?: () => void;
}

export default function SignupScreen({ onSubmit, onNavigateToLogin }: SignupScreenProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!onSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onSubmit(formData);
      if (!result.success) {
        setError(mapApiError(result, t, 'alert.general-error-description'));
      }
    } catch (err) {
      // A network-level failure throws instead of resolving with { error }.
      setError(mapApiError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScreen
      className="bg-background dark:bg-background-dark"
      showsVerticalScrollIndicator={false}
    >
        <View className="px-4 pb-32 relative">

          <View className="pt-8 mb-8">
            <Logo />
            <View className="mt-6">
              <Title>{t('signup.title')}</Title>
            </View>
            <Text className="text-[17px] leading-6 mt-2 text-muted-foreground dark:text-muted-foreground-dark">{t('signup.description')}</Text>
          </View>

          {/* Personal Info Section */}
          <View className="mb-8">
            <Text accessibilityRole="header" className="text-[17px] leading-[22px] font-semibold text-foreground dark:text-foreground-dark mb-3">
              {t('signup.username')}
            </Text>

            <View>

              <View className="mb-4">
                <Text className="text-[13px] leading-[18px] text-foreground dark:text-foreground-dark mb-1.5 font-medium">{t('signup.first-name')}</Text>
                <TextInput
                  className="bg-card dark:bg-card-dark px-3 py-3 min-h-[48px] rounded-[10px] text-[17px] text-foreground dark:text-foreground-dark border border-border-control dark:border-border-control-dark"
                  placeholder={t('signup.first-name.placeholder')}
                  accessibilityLabel={t('signup.first-name')}
                  autoComplete="given-name"
                  textContentType="givenName"
                  placeholderTextColor={themeColors.mutedForeground}
                  value={formData.firstName}
                  onChangeText={(value) => handleInputChange('firstName', value)}
                />
              </View>

              <View className="mb-4">
                <Text className="text-[13px] leading-[18px] text-foreground dark:text-foreground-dark mb-1.5 font-medium">{t('signup.last-name')}</Text>
                <TextInput
                  className="bg-card dark:bg-card-dark px-3 py-3 min-h-[48px] rounded-[10px] text-[17px] text-foreground dark:text-foreground-dark border border-border-control dark:border-border-control-dark"
                  placeholder={t('signup.last-name.placeholder')}
                  accessibilityLabel={t('signup.last-name')}
                  autoComplete="family-name"
                  textContentType="familyName"
                  placeholderTextColor={themeColors.mutedForeground}
                  value={formData.lastName}
                  onChangeText={(value) => handleInputChange('lastName', value)}
                />
              </View>

            </View>
          </View>

          {/* Contact Section */}
          <View className="mb-8">
            <Text accessibilityRole="header" className="text-[17px] leading-[22px] font-semibold text-foreground dark:text-foreground-dark mb-3">
              {t('signup.contact')}
            </Text>

            <View>

              <View className="mb-4">
                <Text className="text-[13px] leading-[18px] text-foreground dark:text-foreground-dark mb-1.5 font-medium">{t('signup.email')}</Text>
                <View className="flex-row items-center bg-card dark:bg-card-dark px-3 min-h-[48px] rounded-[10px] border border-border-control dark:border-border-control-dark" style={{ gap: 8 }}>
                  <IconMail size={18} color={themeColors.mutedForeground} />
                  <TextInput
                    className="flex-1 text-[17px] text-foreground dark:text-foreground-dark"
                    placeholder="user@example.com"
                    placeholderTextColor={themeColors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    accessibilityLabel={t('signup.email')}
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-[13px] leading-[18px] text-foreground dark:text-foreground-dark mb-1.5 font-medium">{t('signup.password')}</Text>
                <View className="flex-row items-center bg-card dark:bg-card-dark px-3 min-h-[48px] rounded-[10px] border border-border-control dark:border-border-control-dark" style={{ gap: 8 }}>
                  <IconLock size={18} color={themeColors.mutedForeground} />
                  <TextInput
                    className="flex-1 text-[17px] text-foreground dark:text-foreground-dark"
                    placeholder="********"
                    placeholderTextColor={themeColors.mutedForeground}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel={t('signup.password')}
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                  />
                </View>
              </View>

            </View>
          </View>

          {error ? (
            <View className="mb-3">
              <Banner tone="danger" body={error} />
            </View>
          ) : null}

          <View className="mt-4" style={{ gap: 10 }}>
            <Button block label={t('signup.button')} onPress={handleSubmit} loading={isSubmitting} />
            <Button block variant="tertiary" label={t('login.title')} onPress={() => onNavigateToLogin?.()} />
          </View>

        </View>
    </KeyboardAwareScreen>
  );
}
