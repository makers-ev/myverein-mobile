import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useTeamHours } from '@/hooks/useTeamHours';
import { formatDuration, formatEuro, shiftMonth } from '@/lib/timeTracking';
import FormSheet from '@/components/ui/FormSheet';
import MonthSwitch from './MonthSwitch';

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
}

/**
 * Team overview for `time:write` / `time:read_rates` holders: confirmed hours per person for a month. The server scopes the
 * rows (department leads: own departments) and only delivers amounts with `time:read_rates`. Calculation basis, no payout;
 * the export (CSV / Excel) is on the website only.
 */
export default function TeamHoursSheet({ visible, onClose, clubId }: Props) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const [month, setMonth] = useState(() => shiftMonth(new Date(), 0));
  useEffect(() => {
    if (visible) setMonth(shiftMonth(new Date(), 0));
  }, [visible]);
  const team = useTeamHours(clubId, visible, month);
  const report = team.report;
  const withAmounts = !!report && report.people.some((p) => typeof p.amountCents === 'number');

  return (
    <FormSheet visible={visible} title={t('time.team.title')} onClose={onClose} cancelLabel={t('ui.done')}>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-1">{t('time.team.note')}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('time.team.export-web')}</Text>
      <MonthSwitch month={month} onChange={setMonth} />
      {team.loading ? (
        <View className="py-8 items-center" accessibilityLabel={t('time.loading')}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : team.error && !report ? (
        <View className="py-4">
          <Text className="text-destructive dark:text-destructive-dark text-sm mb-2" accessibilityRole="alert">
            {apiErrorMessage(team.error, t)}
          </Text>
          <TouchableOpacity onPress={() => void team.reload()} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
            <Text className="text-sm font-semibold text-primary dark:text-primary-dark">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : !report || report.people.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('time.team.empty')}</Text>
      ) : (
        <View>
          <Text className="text-foreground dark:text-foreground-dark text-sm font-bold mb-1">
            {t('time.total', { duration: formatDuration(report.totals.minutes) })}
            {withAmounts && typeof report.totals.amountCents === 'number' ? ` · ${formatEuro(report.totals.amountCents, language)}` : ''}
          </Text>
          {report.people.map((p) => (
            <View key={p.clubMemberId} className="py-2 border-b border-border dark:border-border-dark" accessible>
              <Text className="text-foreground dark:text-foreground-dark text-sm">
                {p.displayName} · {formatDuration(p.minutes)}
              </Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                {t('time.team.entries', { count: p.entries })}
                {withAmounts ? ` · ${typeof p.amountCents === 'number' ? formatEuro(p.amountCents, language) : ''}${p.rateMissing ? ` ${t('time.team.rate-missing')}` : ''}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </FormSheet>
  );
}
