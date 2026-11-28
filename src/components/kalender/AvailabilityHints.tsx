import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, UsersRound } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useAvailabilityHints } from '@/hooks/useAvailabilityHints';
import { sortedNames, type HintInput } from '@/lib/availabilityHints';

interface Props extends HintInput {
  /** The hint covers one occurrence only (series). */
  series?: 'first' | 'this' | null;
}

/**
 * "Wer hat Zeit?" in the event form (Wave 16 M2): counters for everybody the backend lets in, the names of unavailable people
 * only when it sends them. A hint: never blocks saving; "unbekannt" means no entries, not "nicht verfügbar". A 403 hides it.
 */
export default function AvailabilityHints({ series, ...input }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const hints = useAvailabilityHints(input, true);

  if (hints.forbidden) return null;

  const { data } = hints;
  const names = data ? sortedNames(data) : [];
  const failureKey = hints.failure === 'rate' ? 'availability.rate' : hints.failure === 'range' ? 'availability.range' : 'availability.error';

  let body: React.ReactNode;
  if (hints.skip) {
    body = <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t(hints.skip === 'range' ? 'availability.range' : 'availability.incomplete')}</Text>;
  } else if (hints.failure) {
    body = (
      <View>
        <Text accessibilityRole="alert" className="text-destructive dark:text-destructive-dark text-sm">
          {t(failureKey)}
        </Text>
        {hints.failure !== 'range' ? (
          <TouchableOpacity accessibilityRole="button" onPress={hints.retry} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('availability.retry')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  } else if (!data) {
    body = <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('availability.loading')}</Text>;
  } else if (data.counts.total === 0) {
    body = <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('availability.empty')}</Text>;
  } else {
    const { counts } = data;
    body = (
      <View style={{ opacity: hints.loading ? 0.6 : 1 }}>
        <Text className="text-foreground dark:text-foreground-dark text-base font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
          {t('availability.count', { free: counts.verfuegbar, total: counts.total })}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]">
          {t('availability.busy', { count: counts.nicht_verfuegbar })} · {t('availability.unknown', { count: counts.unbekannt })}
        </Text>
        {data.includesNames && names.length > 0 ? (
          <View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setOpen((v) => !v)}
              className="flex-row items-center justify-between"
              style={{ minHeight: 44 }}
            >
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('availability.names', { count: names.length })}</Text>
              {open ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
            </TouchableOpacity>
            {open ? names.map((n, i) => (
              <Text key={`${n}-${i}`} className="text-foreground dark:text-foreground-dark text-sm py-0.5">
                {n}
              </Text>
            )) : null}
          </View>
        ) : null}
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t(`availability.pool.${data.pool}`)}</Text>
        {data.truncated ? <Text className="text-warning dark:text-warning-dark text-xs mt-1">{t('availability.truncated')}</Text> : null}
      </View>
    );
  }

  return (
    <View className="bg-muted dark:bg-muted-dark rounded-card p-3 mb-3" accessibilityLiveRegion="polite">
      <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
        <UsersRound size={16} color={colors.mutedForeground} />
        <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-sm font-semibold">
          {t('availability.title')}
        </Text>
      </View>
      {body}
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">
        {series ? `${t(series === 'first' ? 'availability.series.first' : 'availability.series.this')} ` : ''}
        {t('availability.hint')}
      </Text>
    </View>
  );
}
