import React from 'react';
import { ActivityIndicator } from 'react-native';
import { FileText } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import ListRow from '@/components/ui/ListRow';

interface Props {
  title: string;
  /** Short facts below the title (date, size, source). */
  meta: string;
  busy?: boolean;
  /** Another download is running: the row stays visible but cannot start a second one. */
  disabled?: boolean;
  onPress: () => void;
}

/** One document row inside a `ListSection`: tap downloads and opens/shares the file. The meaning never rides on colour alone. */
export default function DocumentRow({ title, meta, busy, disabled, onPress }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  return (
    <ListRow
      icon={FileText}
      title={title}
      hint={meta || undefined}
      noChevron
      trailing={busy ? <ActivityIndicator color={colors.primaryText} accessibilityLabel={t('docs.open.opening')} /> : undefined}
      onPress={busy || disabled ? () => undefined : onPress}
      accessibilityHint={t('mydocs.open-label', { title })}
    />
  );
}
