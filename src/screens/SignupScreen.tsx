import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Mail, Lock } from 'lucide-react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import Logo from '@/components/Logo';
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
  onSubmit?: (formData: SignupFormData) => Promise<{ success: boolean; error?: string }>;
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
        setError(result.error ?? t('alert.general-error-description'));
      }
    } catch (err) {
      // A network-level failure throws instead of resolving with { error }.
      setError(err instanceof Error ? err.message : t('alert.general-error-description'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScreen
      className="bg-background dark:bg-background-dark"
      showsVerticalScrollIndicator={false}
    >
        <View className="px-6 pb-32 relative">

          <View className="items-center py-8 mb-4">
            <Logo size={56} />
            <Text className="text-xl font-bold text-foreground dark:text-foreground-dark mt-4">{t('signup.title')}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark">{t('signup.description')}</Text>
          </View>

          {/* Personal Info Section */}
          <View className="mb-8">
            <Text className="text-lg font-bold text-foreground dark:text-foreground-dark mb-3 ml-1">
              {t('signup.username')}
            </Text>

            <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4">

              <View className="mb-4">
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1 ml-1 font-medium">First Name</Text>
                <TextInput
                  className="bg-muted dark:bg-muted-dark p-3 rounded-xl text-foreground dark:text-foreground-dark border border-border dark:border-border-dark"
                  placeholder="Your first name"
                  placeholderTextColor={themeColors.mutedForeground}
                  value={formData.firstName}
                  onChangeText={(value) => handleInputChange('firstName', value)}
                />
              </View>

              <View className="mb-4">
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1 ml-1 font-medium">Last Name</Text>
                <TextInput
                  className="bg-muted dark:bg-muted-dark p-3 rounded-xl text-foreground dark:text-foreground-dark border border-border dark:border-border-dark"
                  placeholder="Your last name"
                  placeholderTextColor={themeColors.mutedForeground}
                  value={formData.lastName}
                  onChangeText={(value) => handleInputChange('lastName', value)}
                />
              </View>

            </View>
          </View>

          {/* Contact Section */}
          <View className="mb-8">
            <Text className="text-lg font-bold text-foreground dark:text-foreground-dark mb-3 ml-1">
              Contact
            </Text>

            <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4">

              <View className="mb-4">
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1 ml-1 font-medium">Email</Text>
                <View className="flex-row items-center bg-muted dark:bg-muted-dark p-3 rounded-xl border border-border dark:border-border-dark">
                  <IconMail size={18} color={themeColors.mutedForeground} />
                  <TextInput
                    className="flex-1 text-foreground dark:text-foreground-dark"
                    placeholder="user@example.com"
                    placeholderTextColor={themeColors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1 ml-1 font-medium">{t('signup.password')}</Text>
                <View className="flex-row items-center bg-muted dark:bg-muted-dark p-3 rounded-xl border border-border dark:border-border-dark">
                  <IconLock size={18} color={themeColors.mutedForeground} />
                  <TextInput
                    className="flex-1 text-foreground dark:text-foreground-dark"
                    placeholder="********"
                    placeholderTextColor={themeColors.mutedForeground}
                    secureTextEntry
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                  />
                </View>
              </View>

            </View>
          </View>

          {error ? (
            <Text className="text-destructive text-sm text-center mb-2">{error}</Text>
          ) : null}

          <TouchableOpacity
            className="mt-8 bg-primary dark:bg-primary-dark rounded-xl py-4 active:opacity-80"
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-center font-bold text-lg">{t('signup.button')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4"
            onPress={onNavigateToLogin}
          >
            <Text className="text-center text-primary dark:text-primary-dark font-semibold">{t('login.title')}</Text>
          </TouchableOpacity>

        </View>
    </KeyboardAwareScreen>
  );
}
