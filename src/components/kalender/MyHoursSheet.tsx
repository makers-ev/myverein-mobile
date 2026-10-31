import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useMyHours } from '@/hooks/useMyHours';
import { formatDuration, shiftMonth } from '@/lib/timeTracking';
import FormSheet from '@/components/ui/FormSheet';
import MonthSwitch from './MonthSwitch';

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
}

/** "Meine Stunden": the caller's own open and confirmed hours per month. A report for the club's records, no payout, no amounts. */
export default function MyHoursSheet({ visible, onClose, clubId }: Props) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const [month, setMonth] = useState(() => shiftMonth(new Date(), 0));
  useEffect(() => {
    if (visible) setMonth(shiftMonth(new Date(), 0));
  }, [visible]);
  const hours = useMyHours(clubId, visible, month);
  const finished = useMemo(() => hours.entries.filter((e) => !e.running && e.status !== 'abgelehnt'), [hours.entries]);
  const sum = (status: 'offen' | 'bestaetigt') => finished.filter((e) => e.status === status).reduce((n, e) => n + (e.minutes ?? 0), 0);

  return (
    <FormSheet visible={visible} title={t('time.my.title')} onClose={onClose} cancelLabel={t('ui.done')}>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('time.note')}</Text>
      <MonthSwitch month={month} onChange={setMonth} />
      {hours.loading ? (
        <View className="py-8 items-center" accessibilityLabel={t('time.loading')}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : hours.error && hours.entries.length === 0 ? (
        <View className="py-4">
          <Text className="text-destructive dark:text-destructive-dark text-sm mb-2" accessibilityRole="alert">
            {apiErrorMessage(hours.error, t)}
          </Text>
          <TouchableOpacity onPress={() => void hours.reload()} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
            <Text className="text-sm font-semibold text-primary dark:text-primary-dark">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : finished.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('time.my.empty')}</Text>
      ) : (
        <View>
          <Text className="text-foreground dark:text-foreground-dark text-sm font-bold">{t('time.my.confirmed', { duration: formatDuration(sum('bestaetigt')) })}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">{t('time.my.pending', { duration: formatDuration(sum('offen')) })}</Text>
          {finished.map((e) => (
            <View key={e.id} className="py-2 border-b border-border dark:border-border-dark" accessible>
              <Text className="text-foreground dark:text-foreground-dark text-sm">
                {new Date(e.startedAt).toLocaleDateString(language, { day: 'numeric', month: 'short' })} · {formatDuration(e.minutes ?? 0)}
              </Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                {e.eventTitle ? `${e.eventTitle} · ` : ''}
                {t(`time.status.${e.status}`)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </FormSheet>
  );
}
