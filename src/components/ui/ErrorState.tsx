import React from 'react';
import { Text, View } from 'react-native';
import { CloudOff } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { mapApiError } from '@/lib/mapApiError';
import { useThemeColors } from '@/theme/colors';
import Button from './Button';

interface Props {
  /** The caught error; shown as a localised text, never raw. Omit for the generic text. */
  error?: unknown;
  onRetry?: () => void;
  /** Translation key used when the error has no more specific text (default: the generic error text). */
  fallbackKey?: string;
}

/**
 * Error state (Figma `Feedback / Error`): a neutral sentence (never a code), "Deine Daten sind sicher." and a secondary
 * "Erneut versuchen". Neutral, not red: a failed load is not the reader's fault. Same name and props as the website's
 * `ErrorState`.
 */
export default function ErrorState({ error, onRetry, fallbackKey }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  return (
    <View accessibilityRole="alert" className="py-4">
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <View style={{ marginTop: 1 }}>
          <CloudOff size={20} strokeWidth={1.75} color={colors.mutedForeground} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground dark:text-foreground-dark text-[15px] leading-[22px]">{mapApiError(error, t, fallbackKey)}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-0.5">{t('ui.error.safe')}</Text>
        </View>
      </View>
      {onRetry ? (
        <View className="self-start mt-3" style={{ marginLeft: 30 }}>
          <Button variant="secondary" size="M" label={t('connection.retry')} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
