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
    <View accessibilityRole="alert" className="bg-muted dark:bg-muted-dark rounded-[14px] px-4 py-3 mb-4">
      <Text className="text-foreground dark:text-foreground-dark text-[15px] leading-[22px]">{t('offline.stale', { time })}</Text>
      <DocsLink path={DOCS_PATHS.faq} />
    </View>
  );
}
