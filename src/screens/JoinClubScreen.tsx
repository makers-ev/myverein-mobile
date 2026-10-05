import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { apiFetch, ApiError } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinClub'>;

const CATEGORIES = ['aktiv', 'passiv', 'foerdernd', 'ehrenmitglied', 'jugend'] as const;

/**
 * Wave 1's join flow: a club shares its slug out-of-band (website, flyer,
 * word of mouth) -- there is no public "browse clubs" directory (documented
 * gap, see Concept - MyVerein §7 Future Ideas isn't even the right place,
 * this is a Wave 1 scope call, see the backend's apply-route comment).
 * `POST /club-members/apply` only files an application (201) -- the caller
 * is NOT a member until the board approves it (`ClubApplications` screen),
 * so this screen shows a pending state instead of opening the club, and
 * deliberately loads no membership data. A 409 means "already a member or
 * an application is already open" and is shown as the same friendly state.
 */
export default function JoinClubScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('aktiv');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'new' | 'existing' | null>(null);

  const handleJoin = async () => {
    if (!slug.trim() || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch('/club-members/apply', { method: 'POST', body: { clubSlug: slug.trim(), category } });
      setSubmitted('new');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitted('existing');
        return;
      }
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <KeyboardAwareScreen
        className="bg-muted dark:bg-muted-dark"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }}
      >
        <View className="bg-card dark:bg-card-dark p-6 rounded-2xl items-center">
          <Text className="text-xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark">
            {t(submitted === 'new' ? 'join-club.pending.title' : 'join-club.pending.existing-title')}
          </Text>
          <Text className="text-sm text-center mb-5 text-muted-foreground dark:text-muted-foreground-dark">
            {t(submitted === 'new' ? 'join-club.pending.body' : 'join-club.pending.existing-body')}
          </Text>
          <TouchableOpacity
            className="bg-primary dark:bg-primary-dark rounded-lg py-3 px-6 items-center"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">
              {t('join-club.pending.back')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScreen>
    );
  }

  return (
    <KeyboardAwareScreen
      className="bg-muted dark:bg-muted-dark"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }}
    >
      <Text className="text-3xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark">
        {t('join-club.title')}
      </Text>
      <Text className="text-sm text-center mb-8 text-muted-foreground dark:text-muted-foreground-dark">
        {t('join-club.description')}
      </Text>

      <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
        <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
          {t('join-club.slug.label')}
        </Text>
        <TextInput
          className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-4"
          placeholder={t('join-club.slug.placeholder')}
          placeholderTextColor={themeColors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          value={slug}
          onChangeText={setSlug}
        />

        <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
          {t('join-club.category.label')}
        </Text>
        <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
          {CATEGORIES.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setCategory(value)}
              className={`px-3 py-1.5 rounded-full ${category === value ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark border border-border dark:border-border-dark'}`}
            >
              <Text
                className={`text-xs font-semibold ${category === value ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
              >
                {t(`verein.category.${value}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}

        <TouchableOpacity
          className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center mt-1 ${isSubmitting ? 'opacity-70' : ''}`}
          onPress={() => void handleJoin()}
          disabled={isSubmitting || !slug.trim()}
        >
          {isSubmitting ? (
            <ActivityIndicator color={themeColors.primaryForeground} />
          ) : (
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">
              {t('join-club.submit')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAwareScreen>
  );
}
