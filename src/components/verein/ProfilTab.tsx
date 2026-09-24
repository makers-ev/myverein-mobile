import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiFetch, ApiError } from '@/lib/api';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import { Field, inputClassName } from '@/components/ui/FormSheet';

interface Props {
  clubId: string;
}

/**
 * Self-service edit of the fields a member is allowed to change themselves
 * (birthDate, emergency contact) via `PATCH /club-members/me` -- category,
 * memberNumber, leftAt stay board-only (`members:write`), see
 * club-permissions.ts.
 */
export default function ProfilTab({ clubId }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { membership, loading, refetch } = useOwnMembership(clubId);

  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!membership) return;
    setBirthDate(fromDateString(membership.birthDate));
    setEmergencyContactName(membership.emergencyContactName ?? '');
    setEmergencyContactPhone(membership.emergencyContactPhone ?? '');
  }, [membership]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/club-members/me?clubId=${clubId}`, {
        method: 'PATCH',
        body: {
          // Omitted, not sent as "" -- the backend's Zod schema validates
          // birthDate as an actual date string when present at all.
          ...(birthDate ? { birthDate: toDateString(birthDate) } : {}),
          ...(emergencyContactName.trim() ? { emergencyContactName: emergencyContactName.trim() } : {}),
          ...(emergencyContactPhone.trim() ? { emergencyContactPhone: emergencyContactPhone.trim() } : {}),
        },
      });
      setSaved(true);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !membership) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <View>
      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('profil.section.personal')}</Text>
        <Field label={t('profil.birth-date')}>
          <DateTimeField mode="date" value={birthDate} onChange={setBirthDate} clearable />
        </Field>
      </View>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('profil.section.emergency')}</Text>
        <Field label={t('profil.emergency-contact-name')}>
          <TextInput
            className={inputClassName}
            placeholderTextColor={themeColors.mutedForeground}
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
          />
        </Field>
        <Field label={t('profil.emergency-contact-phone')}>
          <TextInput
            className={inputClassName}
            placeholderTextColor={themeColors.mutedForeground}
            keyboardType="phone-pad"
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
          />
        </Field>
      </View>

      {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}
      {saved && !error ? <Text className="text-success dark:text-success-dark text-sm mb-3">{t('profil.saved')}</Text> : null}

      <TouchableOpacity
        className={`bg-primary dark:bg-primary-dark rounded-xl py-3 items-center ${isSaving ? 'opacity-70' : ''}`}
        onPress={() => void handleSave()}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color={themeColors.primaryForeground} />
        ) : (
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('profil.save')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
