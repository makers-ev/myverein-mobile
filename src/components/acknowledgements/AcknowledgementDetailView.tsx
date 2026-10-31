import React, { useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';

import { Body, Button, Card, ErrorRetry, Loading } from '@/components/assembly/ui';
import OpenFileNotice from '@/components/documents/OpenFileNotice';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useAcknowledgementDetail, useConfirmAcknowledgement } from '@/hooks/useAcknowledgements';
import { useDocumentOpen } from '@/hooks/useDocumentOpen';
import { ackErrorKey, ackNeedsReload, canAnswerNow, type MyAcknowledgement } from '@/lib/acknowledgements';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { acknowledgementDocumentPath, formatDocumentDate } from '@/lib/documents';

interface Props {
  clubId: string;
  item: MyAcknowledgement;
  /** An answer was saved or the server state differs: the list reloads. */
  onChanged: () => void;
  onBack: () => void;
}

const STATUS_KEY = { offen: 'ack.status.offen', bestaetigt: 'ack.status.bestaetigt', abgelehnt: 'ack.status.abgelehnt', abgelaufen: 'ack.status.abgelaufen' } as const;

/**
 * One confirmation request: wording, the exact document version to read, the answer (guardians answer for the child) and,
 * once answered, the record of it ("Nachweis"). A minor with an account sees the request read-only. Re-authentication
 * (`requiresReauth`) asks for the password right here; it is only sent with the answer and cleared afterwards.
 */
export default function AcknowledgementDetailView({ clubId, item, onChanged, onBack }: Props) {
  const { t } = useLanguage();
  const detail = useAcknowledgementDetail(clubId, item.id);
  const file = useDocumentOpen();
  const { confirm, busy } = useConfirmAcknowledgement(clubId);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Prefer the fresh detail; the list row is the fallback while it loads.
  const current = { ...item, ...(detail.data ?? {}), documentTitle: item.documentTitle } as typeof item & { mimeType?: string | null; givenBy?: string | null };
  const answerable = canAnswerNow(current);
  const forChild = current.relation === 'guardian';
  const needsPassword = answerable && current.requiresReauth;

  const answer = async (decision: 'bestaetigt' | 'abgelehnt') => {
    if (needsPassword && !password) {
      setMessage(t('ack.error.reauth_required'));
      return;
    }
    setMessage(null);
    const result = await confirm(item.id, decision, needsPassword ? password : undefined);
    if (result === undefined) return;
    setPassword('');
    if (result === null) {
      onChanged();
      void detail.reload();
      return;
    }
    const key = ackErrorKey(result.error);
    setMessage(key ? t(key) : apiErrorMessage(result.error, t, 'ack.error.generic'));
    if (ackNeedsReload(result.error)) {
      onChanged();
      void detail.reload();
    }
  };

  // A legally relevant answer gets one more deliberate step; the dialog names the document and, for a child, the child.
  const ask = (decision: 'bestaetigt' | 'abgelehnt') => {
    if (needsPassword && !password) {
      setMessage(t('ack.error.reauth_required'));
      return;
    }
    const who = forChild ? t('ack.for-child', { name: item.personName }) : '';
    Alert.alert(decision === 'bestaetigt' ? t('ack.dialog.confirm.title') : t('ack.dialog.decline.title'), [item.documentTitle, who].filter(Boolean).join('\n'), [
      { text: t('ack.dialog.cancel'), style: 'cancel' },
      { text: decision === 'bestaetigt' ? t('ack.confirm') : t('ack.decline'), style: decision === 'bestaetigt' ? 'default' : 'destructive', onPress: () => void answer(decision) },
    ]);
  };

  const mimeType = current.mimeType ?? 'application/pdf';
  const proofBy = current.givenBy === 'guardian' ? t('ack.proof.by-guardian') : current.givenBy === 'board_paper' ? t('ack.proof.by-board') : t('ack.proof.by-self');

  return (
    <>
      <Button secondary label={t('ack.back')} onPress={onBack} />
      <Card title={item.documentTitle}>
        <Body muted>{t('ack.version', { n: item.versionNo })}</Body>
        {forChild ? <Body>{t('ack.for-child', { name: item.personName })}</Body> : null}
        {item.dueAt ? <Body muted>{t('ack.due', { date: formatDocumentDate(item.dueAt) })}</Body> : null}
        <Body>{item.wording}</Body>
        <OpenFileNotice error={file.error} unsupported={file.unsupported} />
        <Button
          secondary
          label={file.busyId ? t('docs.open.opening') : t('ack.read')}
          busy={!!file.busyId}
          onPress={() => void file.open({ id: item.id, path: acknowledgementDocumentPath(clubId, item.id), title: item.documentTitle, mimeType })}
        />
        {!item.isCurrentVersion ? <Body muted>{t('ack.old-version')}</Body> : null}
      </Card>

      {detail.loading && !detail.data ? <Loading /> : null}
      {detail.error && !detail.data ? <ErrorRetry message={apiErrorMessage(detail.error, t, 'ack.error.load')} onRetry={() => void detail.reload()} /> : null}

      {answerable ? (
        <Card title={forChild ? t('ack.answer-for', { name: item.personName }) : t('ack.answer')}>
          {needsPassword ? (
            <>
              <Body muted>{t('ack.password-hint')}</Body>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                accessibilityLabel={t('ack.password')}
                placeholder={t('ack.password')}
                className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-2 min-h-[48px]"
              />
            </>
          ) : null}
          <Button label={t('ack.confirm')} busy={busy} disabled={busy} onPress={() => ask('bestaetigt')} />
          <Button secondary label={t('ack.decline')} disabled={busy} onPress={() => ask('abgelehnt')} />
          {message ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="text-destructive dark:text-destructive-dark text-sm">
              {message}
            </Text>
          ) : null}
          <Body muted>{t('ack.notice')}</Body>
        </Card>
      ) : (
        <Card title={t('ack.proof.title')}>
          <Body>{t(STATUS_KEY[current.status])}</Body>
          {current.respondedAt ? <Body muted>{t('ack.proof.at', { date: formatDocumentDate(current.respondedAt) })}</Body> : null}
          {current.status === 'bestaetigt' || current.status === 'abgelehnt' ? <Body muted>{proofBy}</Body> : null}
          {current.status === 'offen' && !current.canAnswer ? <Body muted>{t('ack.read-only')}</Body> : null}
          {current.status === 'abgelaufen' ? <Body muted>{t('ack.expired-hint')}</Body> : null}
          {message ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="text-destructive dark:text-destructive-dark text-sm">
              {message}
            </Text>
          ) : null}
          <Body muted>{t('ack.notice')}</Body>
        </Card>
      )}
    </>
  );
}
