import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { FileText } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

interface Props {
  title: string;
  /** Short facts below the title (date, size, source). */
  meta: string;
  busy?: boolean;
  /** Another download is running: the row stays visible but cannot start a second one. */
  disabled?: boolean;
  isLast?: boolean;
  onPress: () => void;
}

/** One tappable document row (>= 48pt): tap downloads and opens/shares the file. The meaning never rides on colour alone. */
export default function DocumentRow({ title, meta, busy, disabled, isLast, onPress }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={t('mydocs.open-label', { title })}
      accessibilityHint={busy ? t('docs.open.opening') : meta}
      accessibilityState={{ busy: !!busy, disabled: !!(busy || disabled) }}
      className={`flex-row items-center py-3 ${isLast ? '' : 'border-b border-border dark:border-border-dark'} ${disabled && !busy ? 'opacity-50' : ''}`}
      style={{ minHeight: 48, gap: 12 }}
    >
      <FileText size={20} color={colors.primary} />
      <View className="flex-1">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold" numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}
