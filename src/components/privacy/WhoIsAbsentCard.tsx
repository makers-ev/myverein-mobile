import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { parseDayKey } from '@/lib/ward';
import { useClubAbsencesToday } from '@/hooks/useAbsences';
import ListSection from '@/components/ui/ListSection';
import ListRow from '@/components/ui/ListRow';
import ErrorState from '@/components/ui/ErrorState';

/**
 * "Wer fehlt heute" for holders of `absences:read` (the caller gates it), as a read-only list section (no chevrons): name and end of the absence only. Kind and note
 * are deliberately not shown here (data minimisation); the backend already limits trainers to their own departments.
 */
export default function WhoIsAbsentCard({ clubId }: { clubId: string }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { absences, loading, error, reload } = useClubAbsencesToday(clubId, true);

  const until = (endsOn: string) => t('absence.today.until', { date: parseDayKey(endsOn).toLocaleDateString(language, { day: 'numeric', month: 'short' }) });
  if (loading && absences.length === 0 && !error) {
    return (
      <ListSection title={t('absence.today.title')}>
        <View key="l" className="py-4">
          <ActivityIndicator color={themeColors.primaryText} />
        </View>
      </ListSection>
    );
  }
  if (error && absences.length === 0) {
    return (
      <ListSection title={t('absence.today.title')}>
        <View key="e" className="px-4">
          <ErrorState fallbackKey="absence.today.error" onRetry={() => void reload()} />
        </View>
      </ListSection>
    );
  }
  return (
    <ListSection title={t('absence.today.title')}>
      {absences.length === 0 ? (
        <ListRow key="none" title={t('absence.today.empty')} />
      ) : (
        absences.map((a) => <ListRow key={a.id} title={a.displayName ?? '—'} value={a.startsOn === a.endsOn ? undefined : until(a.endsOn)} />)
      )}
    </ListSection>
  );
}
