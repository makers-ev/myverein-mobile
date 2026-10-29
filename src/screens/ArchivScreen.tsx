import React, { useCallback, useState } from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { Body, Card, Loading } from '@/components/assembly/ui';
import ArchiveBrowser from '@/components/documents/ArchiveBrowser';
import { useLanguage } from '@/contexts/translation/LanguageContext';

/**
 * "Archiv" (Wave 13 M8), read-only: folders and documents of the active club the member may read, search, download.
 * Reached from Verein > Vereinsinfo; the entry only shows when `GET /documents/folders` offers a folder or root level.
 * Android back first walks up the folder tree. Uploading and managing stay on the website.
 */
export default function ArchivScreen() {
  const { t } = useLanguage();
  const { activeClub, loading } = useActiveClub();
  const clubId = activeClub?.clubId ?? null;
  // The folder belongs to a club: a club switch must not carry the id over (the browser is keyed by club too).
  const [state, setState] = useState<{ clubId: string | null; folderId: string | null }>({ clubId: null, folderId: null });
  const folderId = state.clubId === clubId ? state.folderId : null;
  const setFolder = useCallback((id: string | null) => setState({ clubId, folderId: id }), [clubId]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!folderId) return false;
        setFolder(null);
        return true;
      });
      return () => sub.remove();
    }, [folderId, setFolder]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 140 }}>
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('archive.title')}
        </Text>
        {activeClub?.clubName ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{activeClub.clubName}</Text> : <View className="mb-4" />}
        {loading ? (
          <Loading />
        ) : !clubId ? (
          <Card>
            <Body muted>{t('archive.no-club')}</Body>
          </Card>
        ) : (
          <ArchiveBrowser key={clubId} clubId={clubId} folderId={folderId} onFolderChange={setFolder} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
