import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import { useAcknowledgements } from '@/hooks/useAcknowledgements';
import { useOwnMembership } from '@/hooks/useOwnMembership';
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

/**
 * Entry to "Bestätigungen". Visible when the club has any request for the caller (open ones count in the hint); an empty
 * list or a failed load shows no entry, so members without requests are not distracted (deny by default).
 */
export function AcknowledgementsEntry({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { items, openCount } = useAcknowledgements(clubId);
  if (!items || items.length === 0) return null;
  const hint = openCount > 0 ? t('ack.entry.open', { count: openCount }) : t('ack.entry.hint');
  return <EntryRow title={t('ack.entry')} hint={hint} onPress={() => navigate('Bestaetigungen')} />;
}

/** Entry to the digital membership card (own card; a guardian reaches the children's cards on the same screen). */
export function MyCardEntry({ forChild }: { forChild?: boolean }) {
  const { t } = useLanguage();
  return <EntryRow title={forChild ? t('card.entry.child') : t('card.entry')} hint={t('card.entry.hint')} onPress={() => navigate('Mitgliedsausweis')} />;
}

/** Entry to the card check; shown only with `member_cards:verify` (deny by default while loading or on error). */
export function CardCheckEntry({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { can } = useOwnMembership(clubId);
  if (!can('member_cards:verify')) return null;
  return <EntryRow title={t('check.entry')} hint={t('check.entry.hint')} onPress={() => navigate('AusweisKontrolle')} />;
}
