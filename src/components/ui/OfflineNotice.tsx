import React from 'react';
import { Text, View } from 'react-native';

import DocsLink from '@/components/ui/DocsLink';
import { DOCS_PATHS } from '@/lib/docsUrl';
import { useLanguage } from '@/contexts/translation/LanguageContext';

/** "You are offline, this is the copy from <time>" line for read-only offline copies (Kalender, Mitgliederliste). */
export default function OfflineNotice({ savedAt }: { savedAt: string }) {
  const { t, language } = useLanguage();
  const d = new Date(savedAt);
  const time = `${d.toLocaleDateString(language, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}`;
  return (
    <View accessibilityRole="alert" className="bg-muted dark:bg-muted-dark border border-border dark:border-border-dark rounded-xl p-3 mb-3">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('offline.stale', { time })}</Text>
      <DocsLink path={DOCS_PATHS.faq} />
    </View>
  );
}
