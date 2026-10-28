import React from 'react';
import { Text, View } from 'react-native';

import { Body, Card, ErrorRetry, Loading } from '@/components/assembly/ui';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useDocumentOpen } from '@/hooks/useDocumentOpen';
import { useMemberDocuments, type MemberDocumentsSubject } from '@/hooks/useDocuments';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { formatDocumentDate, formatFileSize, memberDocumentDownloadPath } from '@/lib/documents';
import { isNotFound } from '@/lib/ward';
import DocumentRow from './DocumentRow';
import OpenFileNotice from './OpenFileNotice';

interface Props {
  subject: MemberDocumentsSubject;
  /** First name of the child for the empty state; `null` for the own storage. */
  wardName: string | null;
  /** The access ended (404 on a ward): the screen reloads its wards. */
  onGone: () => void;
}

/** Personal documents of one subject: list, tap opens/shares the file through the authenticated download. Read-only. */
export default function MemberDocumentsList({ subject, wardName, onGone }: Props) {
  const { t } = useLanguage();
  const { documents, loading, error, reload } = useMemberDocuments(subject);
  const file = useDocumentOpen();
  const memberId = subject.kind === 'self' ? 'me' : subject.wardId;
  const gone = isNotFound(error) && !documents;

  React.useEffect(() => {
    if (gone && subject.kind === 'ward') onGone();
  }, [gone, subject.kind, onGone]);

  if (loading && !documents) return <Loading />;
  if (gone) {
    return (
      <Card>
        <Body muted>{t('mydocs.gone')}</Body>
      </Card>
    );
  }
  if (!documents) return <ErrorRetry message={apiErrorMessage(error, t, 'mydocs.error')} onRetry={() => void reload()} />;
  if (documents.length === 0) {
    return (
      <Card>
        <Body muted>{wardName ? t('mydocs.empty-child', { name: wardName }) : t('mydocs.empty')}</Body>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <OpenFileNotice error={file.error} unsupported={file.unsupported} />
        {documents.map((d, i) => (
          <DocumentRow
            key={d.id}
            title={d.title}
            meta={[formatDocumentDate(d.createdAt), formatFileSize(d.sizeBytes), t(`mydocs.source.${d.source}`), d.hidden ? t('mydocs.hidden') : null].filter(Boolean).join(' · ')}
            busy={file.busyId === d.id}
            disabled={!!file.busyId}
            isLast={i === documents.length - 1}
            onPress={() => void file.open({ id: d.id, path: memberDocumentDownloadPath(subject.clubId, memberId, d.id), title: d.title, mimeType: d.mimeType })}
          />
        ))}
      </Card>
      <View accessible>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('mydocs.privacy')}</Text>
      </View>
    </>
  );
}
