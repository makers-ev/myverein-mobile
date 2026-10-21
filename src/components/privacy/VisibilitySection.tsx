import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { VISIBILITY_FIELDS, VISIBILITY_LEVELS, type VisibilityField, type VisibilityLevel } from '@/lib/privacyCenter';
import { useFieldVisibility } from '@/hooks/usePrivacyCenter';
import PrivacyCard from './PrivacyCard';

/**
 * Who besides the board sees phone, e-mail, address and photo. Default is "Nur Vorstand" (nothing shared); the person
 * decides per field. Each change is saved at once and rolled back with a message if the server refuses.
 */
export default function VisibilitySection({ clubId, clubMemberId }: { clubId: string; clubMemberId: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { levels, loading, error, reload, setLevel } = useFieldVisibility(clubId, clubMemberId);
  const [saveError, setSaveError] = useState<string | null>(null);

  const choose = async (field: VisibilityField, level: VisibilityLevel) => {
    if (levels?.[field] === level) return;
    setSaveError(null);
    const res = await setLevel(field, level);
    if (!res.ok) setSaveError(apiErrorMessage(res.error, t, 'datenschutz.visibility.save-error'));
  };

  return (
    <PrivacyCard title={t('datenschutz.visibility.title')} intro={t('datenschutz.visibility.intro')}>
      {loading && !levels && !error ? (
        <ActivityIndicator color={themeColors.primary} />
      ) : !levels ? (
        <>
          <Text className="text-destructive text-sm">{apiErrorMessage(error, t, 'datenschutz.visibility.load-error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        VISIBILITY_FIELDS.map((field) => (
          <View key={field} className="border-t border-border dark:border-border-dark py-3">
            <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold mb-2">{t(`datenschutz.visibility.field.${field}`)}</Text>
            <View className="flex-row" style={{ gap: 6 }} accessibilityRole="radiogroup">
              {VISIBILITY_LEVELS.map((level) => {
                const selected = levels[field] === level;
                return (
                  <TouchableOpacity
                    key={level}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${t(`datenschutz.visibility.field.${field}`)}: ${t(`datenschutz.visibility.level.${level}`)}`}
                    onPress={() => void choose(field, level)}
                    className={`flex-1 rounded-xl items-center justify-center border ${selected ? 'bg-primary dark:bg-primary-dark border-transparent' : 'border-border dark:border-border-dark'}`}
                    style={{ minHeight: 44, paddingHorizontal: 4 }}
                  >
                    <Text
                      className={`text-xs font-semibold text-center ${selected ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}
                    >
                      {t(`datenschutz.visibility.level.${level}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))
      )}
      {saveError ? (
        <Text className="text-destructive text-sm mt-2" accessibilityRole="alert">
          {saveError}
        </Text>
      ) : null}
    </PrivacyCard>
  );
}
