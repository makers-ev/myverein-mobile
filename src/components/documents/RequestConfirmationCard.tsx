import React, { useState } from 'react';

import { Body, Button, Card } from '@/components/assembly/ui';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useDocumentGeneration } from '@/hooks/useDocumentGeneration';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { generationErrorKey, isJobRunning, jobErrorKey } from '@/lib/documents';
import { Text } from 'react-native';

interface Props {
  clubId: string;
  clubMemberId: string;
  /** The finished PDF lies in the personal storage: the parent reloads the list and opens it. */
  onReady: (documentId: string) => void;
  /** Another file download is running (share sheet): the button waits. */
  disabled?: boolean;
}

/** "Mitgliedsbestätigung anfordern": one tap creates the PDF (template `mitgliedsbestaetigung`, status as of today) and opens it. */
export default function RequestConfirmationCard({ clubId, clubMemberId, onReady, disabled }: Props) {
  const { t } = useLanguage();
  const { request, working } = useDocumentGeneration(clubId);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setMessage(null);
    const outcome = await request('mitgliedsbestaetigung', { clubMemberId });
    if (!outcome) return;
    if (!outcome.ok) {
      const key = generationErrorKey(outcome.error);
      setMessage(key ? t(key) : apiErrorMessage(outcome.error, t, 'confirmation.error.generic'));
      return;
    }
    const { job } = outcome;
    if (job.status === 'fertig' && job.documentId) onReady(job.documentId);
    else if (isJobRunning(job)) setMessage(t('confirmation.still-running'));
    else setMessage(t(jobErrorKey(job.errorCode)));
  };

  return (
    <Card title={t('confirmation.title')}>
      <Body muted>{t('confirmation.hint')}</Body>
      <Button label={working ? t('confirmation.working') : t('confirmation.request')} onPress={() => void run()} busy={working} disabled={disabled} />
      {message ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="text-destructive text-sm">
          {message}
        </Text>
      ) : null}
    </Card>
  );
}
