import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Body, Button, Card, ErrorRetry, Loading } from '@/components/assembly/ui';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useDocumentOpen } from '@/hooks/useDocumentOpen';
import { useArchiveDocuments, useArchiveFolders } from '@/hooks/useDocuments';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { archiveDownloadPath, canOpenArchive, childFolders, folderTrail, formatDocumentDate, formatFileSize } from '@/lib/documents';
import DocumentRow from './DocumentRow';
import OpenFileNotice from './OpenFileNotice';

interface Props {
  clubId: string;
  /** Current folder (`null` = root level); controlled by the screen so Android back can walk up. */
  folderId: string | null;
  onFolderChange: (folderId: string | null) => void;
}

/**
 * Read-only archive ("Vorstand light", M8): folders the member may read, documents of the open folder, title search,
 * download + open/share. Visibility is decided entirely by the backend (folder rights); uploading, moving, trash and
 * rights stay on the website.
 */
export default function ArchiveBrowser({ clubId, folderId, onFolderChange }: Props) {
  const { t } = useLanguage();
  const folders = useArchiveFolders(clubId);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const docs = useArchiveDocuments(clubId, folderId, query);
  const file = useDocumentOpen();
  const searching = query.trim().length > 0;

  if (folders.loading && !folders.answer) return <Loading />;
  if (!folders.answer && folders.error) return <ErrorRetry message={apiErrorMessage(folders.error, t, 'archive.error')} onRetry={() => void folders.reload()} />;
  if (!canOpenArchive(folders.answer)) {
    return (
      <Card>
        <Body muted>{t('archive.no-access')}</Body>
      </Card>
    );
  }
  const all = folders.answer!.data;
  const subFolders = searching ? [] : childFolders(all, folderId);
  const trail = folderTrail(all, folderId);
  const trailText = trail.map((f) => f.name).join(' / ');

  return (
    <>
      <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => setQuery(draft.trim())}
          returnKeyType="search"
          maxLength={100}
          placeholder={t('archive.search')}
          accessibilityLabel={t('archive.search')}
          className="flex-1 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl px-3 text-foreground dark:text-foreground-dark text-sm"
          style={{ minHeight: 48 }}
        />
        {searching || draft ? (
          <TouchableOpacity
            onPress={() => {
              setDraft('');
              setQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('archive.search.clear')}
            style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text className="text-primary dark:text-primary-dark text-lg font-bold">×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!searching && folderId ? (
        <TouchableOpacity
          onPress={() => onFolderChange(trail.length > 1 ? trail[trail.length - 2]!.id : null)}
          accessibilityRole="button"
          accessibilityLabel={t('archive.up')}
          accessibilityHint={t('archive.trail', { path: trailText })}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text className="text-primary dark:text-primary-dark font-semibold text-sm">{`‹ ${trailText || t('archive.root')}`}</Text>
        </TouchableOpacity>
      ) : null}

      {subFolders.length > 0 ? (
        <Card title={t('archive.folders')}>
          {subFolders.map((f, i) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => onFolderChange(f.id)}
              accessibilityRole="button"
              accessibilityLabel={t('archive.folder-label', { name: f.name })}
              className={`flex-row items-center justify-between py-3 ${i === subFolders.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}
              style={{ minHeight: 48 }}
            >
              <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold flex-1" numberOfLines={2}>
                {f.name}
              </Text>
              <Text className="text-primary dark:text-primary-dark font-bold text-sm">›</Text>
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}

      {!searching && !folderId ? (
        subFolders.length === 0 ? (
          <Card>
            <Body muted>{t('archive.empty')}</Body>
          </Card>
        ) : null
      ) : docs.loading && !docs.documents ? (
        <Loading />
      ) : !docs.documents ? (
        <ErrorRetry message={apiErrorMessage(docs.error, t, 'archive.error')} onRetry={() => void docs.reload()} />
      ) : docs.documents.length === 0 ? (
        subFolders.length === 0 || searching ? (
          <Card>
            <Body muted>{searching ? t('archive.search.empty') : t('archive.empty')}</Body>
          </Card>
        ) : null
      ) : (
        <Card title={t('archive.documents')}>
          <OpenFileNotice error={file.error} unsupported={file.unsupported} />
          {docs.documents.map((d, i) => (
            <DocumentRow
              key={d.id}
              title={d.title}
              meta={[formatDocumentDate(d.updatedAt), formatFileSize(d.currentVersion?.sizeBytes), d.kind === 'erzeugt' ? t('archive.generated') : null].filter(Boolean).join(' · ')}
              busy={file.busyId === d.id}
              disabled={!!file.busyId || !d.currentVersion}
              isLast={i === docs.documents!.length - 1}
              onPress={() =>
                void file.open({ id: d.id, path: archiveDownloadPath(clubId, d.id), title: d.title, mimeType: d.currentVersion?.mimeType })
              }
            />
          ))}
          {docs.hasMore ? <Button secondary label={t('archive.more')} busy={docs.loading} onPress={docs.loadMore} /> : null}
        </Card>
      )}

      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t('archive.read-only')}</Text>
    </>
  );
}
