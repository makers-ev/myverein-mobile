import React from 'react';
import { Text, View } from 'react-native';

import { Body, Card, ErrorRetry, Loading } from '@/components/assembly/ui';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useDocumentOpen } from '@/hooks/useDocumentOpen';
import { useGenerationTemplates } from '@/hooks/useDocumentGeneration';
import { useMemberDocuments, type MemberDocumentsSubject } from '@/hooks/useDocuments';
import { useReportOnce } from '@/hooks/useReportOnce';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { formatDocumentDate, formatFileSize, memberDocumentDownloadPath } from '@/lib/documents';
import { isNotFound } from '@/lib/ward';
import DocumentRow from './DocumentRow';
import OpenFileNotice from './OpenFileNotice';
import RequestConfirmationCard from './RequestConfirmationCard';

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
  // "Mitgliedsbestätigung anfordern" is offered for the own storage only, and only when the backend lists the template.
  const ownClubId = subject.kind === 'self' ? subject.clubId : null;
  const { membership } = useOwnMembership(ownClubId);
  const templates = useGenerationTemplates(ownClubId);
  const canRequest = !!ownClubId && !!membership?.clubMemberId && templates.can('mitgliedsbestaetigung');
  const openGenerated = async (documentId: string) => {
    void reload();
    await file.open({
      id: documentId,
      path: memberDocumentDownloadPath(subject.clubId, 'me', documentId),
      title: t('confirmation.file-title'),
      mimeType: 'application/pdf',
    });
  };
  const requestCard =
    canRequest && ownClubId && membership?.clubMemberId ? (
      <RequestConfirmationCard clubId={ownClubId} clubMemberId={membership.clubMemberId} disabled={!!file.busyId} onReady={(id) => void openGenerated(id)} />
    ) : null;

  // Once per child that turned out to be gone: the parent's wards reload re-renders this list, so no effect on `onGone`.
  useReportOnce(gone && subject.kind === 'ward', subject.kind === 'ward' ? `${subject.clubId}:${subject.wardId}` : null, onGone);

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
      <>
        {requestCard}
        <OpenFileNotice error={file.error} unsupported={file.unsupported} />
        <Card>
          <Body muted>{wardName ? t('mydocs.empty-child', { name: wardName }) : t('mydocs.empty')}</Body>
        </Card>
      </>
    );
  }

  return (
    <>
      {requestCard}
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
