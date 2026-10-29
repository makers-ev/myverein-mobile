import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { mapApiError } from '@/lib/mapApiError';

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
  return (
    <View accessibilityRole="alert" className="py-4">
      <Text className="text-destructive dark:text-destructive-dark text-sm mb-1">{mapApiError(error, t, fallbackKey)}</Text>
      {onRetry ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('connection.retry')}
          onPress={onRetry}
          className="min-h-[44px] justify-center self-start"
        >
          <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
