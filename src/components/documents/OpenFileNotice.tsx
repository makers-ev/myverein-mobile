import React from 'react';
import { Text } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { apiErrorMessage } from '@/lib/apiErrorMessage';

/** Inline notice for a failed or unsupported "open file" action (announced to screen readers). */
export default function OpenFileNotice({ error, unsupported }: { error: unknown; unsupported: boolean }) {
  const { t } = useLanguage();
  if (!error && !unsupported) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="text-destructive text-sm mb-2">
      {unsupported ? t('docs.open.unsupported') : apiErrorMessage(error, t, 'docs.open.error')}
    </Text>
  );
}
