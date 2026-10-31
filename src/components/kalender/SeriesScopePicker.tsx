import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import type { SeriesScope } from '@/lib/eventSeries';
import { Field } from '@/components/ui/FormSheet';
import { ColorChip } from './ColorChip';

interface Props {
  scope: SeriesScope;
  onChange: (scope: SeriesScope) => void;
  /** Confirmed + waitlisted sign-ups of the opened occurrence, warned about before the user picks a wider scope. */
  signups: number;
  disabled?: boolean;
}

const SCOPES: SeriesScope[] = ['this', 'this_and_following', 'all'];

/** "Nur dieser Termin / Dieser und folgende / Alle Termine" for edit, delete and cancel of a recurring event. */
export default function SeriesScopePicker({ scope, onChange, signups, disabled }: Props) {
  const { t } = useLanguage();
  return (
    <Field label={t('series.scope.title')}>
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {SCOPES.map((value) => (
          <ColorChip key={value} label={t(`series.scope.${value}`)} active={scope === value} onPress={() => onChange(value)} disabled={disabled} />
        ))}
      </View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t(`series.scope.${scope}.hint`)}</Text>
      {signups > 0 ? (
        <Text className="text-foreground dark:text-foreground-dark text-xs font-semibold mt-1" accessibilityLiveRegion="polite">
          {t('series.scope.signups', { count: signups })}
        </Text>
      ) : null}
    </Field>
  );
}
