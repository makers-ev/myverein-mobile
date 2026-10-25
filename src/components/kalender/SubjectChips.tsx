import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import type { Ward } from '@/lib/ward';
import { ColorChip } from './ColorChip';

/** "Für wen?" -- the caller (`null`) or one of their wards. Renders nothing without wards. */
export default function SubjectChips({
  wards,
  value,
  onChange,
  disabled,
}: {
  wards: readonly Ward[];
  /** `null` = the caller, otherwise the ward's club member id. */
  value: string | null;
  onChange: (wardId: string | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  if (wards.length === 0) return null;
  return (
    <View className="mb-3" accessibilityRole="radiogroup">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">{t('reg.subject')}</Text>
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        <ColorChip label={t('reg.subject.me')} active={value === null} onPress={() => onChange(null)} disabled={disabled} />
        {wards.map((w) => (
          <ColorChip key={w.wardId} label={w.firstName ?? w.name} active={value === w.wardId} onPress={() => onChange(w.wardId)} disabled={disabled} />
        ))}
      </View>
    </View>
  );
}
