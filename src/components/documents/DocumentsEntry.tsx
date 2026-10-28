import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import { useArchiveFolders } from '@/hooks/useDocuments';
import { canOpenArchive } from '@/lib/documents';

function EntryRow({ title, hint, onPress }: { title: string; hint: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3 flex-row items-center justify-between"
      style={{ minHeight: 56 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
    >
      <View className="flex-1 pr-2">
        <Text className="text-primary dark:text-primary-dark font-bold text-sm">{title}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{hint}</Text>
      </View>
      <Text className="text-primary dark:text-primary-dark font-bold text-sm">›</Text>
    </TouchableOpacity>
  );
}

/** Entry to the caller's personal storage (every member; children's storage is reached from the same screen). */
export function MyDocumentsEntry() {
  const { t } = useLanguage();
  return <EntryRow title={t('mydocs.entry')} hint={t('mydocs.entry.hint')} onPress={() => navigate('MeineDokumente')} />;
}

/**
 * Entry to the read-only archive. No global permission opens it (a member may hold a folder right only), so it probes
 * `GET /documents/folders` and renders nothing unless the member sees a folder or has a root level -- external guests
 * (403) and loading/error states show no entry (deny by default).
 */
export function ArchiveEntry({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { answer } = useArchiveFolders(clubId);
  if (!canOpenArchive(answer)) return null;
  return <EntryRow title={t('archive.entry')} hint={t('archive.entry.hint')} onPress={() => navigate('Archiv')} />;
}
