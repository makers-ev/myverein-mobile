import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { parseDayKey } from '@/lib/ward';
import { useClubAbsencesToday } from '@/hooks/useAbsences';
import BentoTile from '@/components/ui/BentoTile';

/**
 * "Wer fehlt heute" for holders of `absences:read` (the caller gates it): name and end of the absence only. Kind and note
 * are deliberately not shown here (data minimisation); the backend already limits trainers to their own departments.
 */
export default function WhoIsAbsentCard({ clubId }: { clubId: string }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { absences, loading, error, reload } = useClubAbsencesToday(clubId, true);

  return (
    <BentoTile minHeight={88}>
      <Text accessibilityRole="header" className="text-primary dark:text-primary-dark text-xs font-bold uppercase tracking-wider mb-3">
        {t('absence.today.title')}
      </Text>
      {loading && absences.length === 0 && !error ? (
        <ActivityIndicator color={themeColors.primary} />
      ) : error && absences.length === 0 ? (
        <View>
          <Text className="text-destructive text-sm">{t('absence.today.error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : absences.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('absence.today.empty')}</Text>
      ) : (
        absences.map((a) => (
          <View key={a.id} className="flex-row justify-between py-1.5" style={{ gap: 8 }}>
            <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm font-semibold" numberOfLines={1}>
              {a.displayName ?? '—'}
            </Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
              {a.startsOn === a.endsOn ? '' : t('absence.today.until', { date: parseDayKey(a.endsOn).toLocaleDateString(language, { day: 'numeric', month: 'short' }) })}
            </Text>
          </View>
        ))
      )}
    </BentoTile>
  );
}
