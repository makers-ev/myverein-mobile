import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CircleAlert } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { mapApiError } from '@/lib/mapApiError';
import { useThemeColors } from '@/theme/colors';

interface Props {
  /** The caught error; shown as a localised text, never raw. Omit for the generic text. */
  error?: unknown;
  onRetry?: () => void;
  /** Translation key used when the error has no more specific text (default: the generic error text). */
  fallbackKey?: string;
}

/** Understandable, localised error with a retry button. Same name and props as the website's `ErrorState`. */
export default function ErrorState({ error, onRetry, fallbackKey }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  return (
    <View accessibilityRole="alert" className="py-4">
      <View className="flex-row items-start" style={{ gap: 8 }}>
        <View style={{ marginTop: 2 }}>
          <CircleAlert size={16} strokeWidth={1.5} color={colors.destructive} />
        </View>
        <Text className="flex-1 text-destructive dark:text-destructive-dark text-sm">{mapApiError(error, t, fallbackKey)}</Text>
      </View>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('connection.retry')}
          onPress={onRetry}
          className="min-h-[44px] justify-center self-start"
          style={{ marginLeft: 24 }}
        >
          <Text className="text-primary dark:text-primary-dark font-medium text-sm">{t('connection.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
