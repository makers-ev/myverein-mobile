import React from 'react';

import { Body, Button, Card, ErrorRetry, Loading } from '@/components/assembly/ui';
import OpenFileNotice from '@/components/documents/OpenFileNotice';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useDocumentOpen } from '@/hooks/useDocumentOpen';
import { type MemberCardSubject, useMemberCard } from '@/hooks/useMemberCard';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { type CardPdfLayout, cardPdfPath } from '@/lib/documents';
import { effectiveCardState, localDay } from '@/lib/memberCard';
import MemberCardView from './MemberCardView';

/** Card of one subject with all states: loading, error + retry, no card, not issued, offline copy, PDF sharing. */
export default function MemberCardPanel({ subject }: { subject: MemberCardSubject }) {
  const { t } = useLanguage();
  const { view, loading, gone, failed, error, reload } = useMemberCard(subject);
  const file = useDocumentOpen();
  const memberKey = subject.kind === 'self' ? 'me' : subject.wardId;

  if (loading) return <Loading />;
  if (gone) {
    return (
      <Card>
        <Body muted>{t('card.gone')}</Body>
      </Card>
    );
  }
  if (failed || !view) return <ErrorRetry message={apiErrorMessage(error, t, 'card.error')} onRetry={() => void reload()} />;

  const state = effectiveCardState(view.card, localDay(new Date()));
  const share = (layout: CardPdfLayout) =>
    void file.open({ id: layout, path: cardPdfPath(subject.clubId, memberKey, layout), title: t('card.pdf-title'), mimeType: 'application/pdf' });

  return (
    <>
      <MemberCardView view={view} onPhotoExpired={() => void reload()} />
      {state === 'nicht_ausgestellt' ? (
        <Card>
          <Body muted>{t('card.not-issued')}</Body>
        </Card>
      ) : null}
      {state === 'gueltig' && !view.fromCache ? (
        <Card title={t('card.pdf')}>
          <OpenFileNotice error={file.error} unsupported={file.unsupported} />
          <Button label={t('card.pdf-card')} busy={file.busyId === 'card'} disabled={!!file.busyId} onPress={() => share('card')} />
          <Button secondary label={t('card.pdf-a4')} busy={file.busyId === 'a4'} disabled={!!file.busyId} onPress={() => share('a4')} />
        </Card>
      ) : null}
    </>
  );
}
