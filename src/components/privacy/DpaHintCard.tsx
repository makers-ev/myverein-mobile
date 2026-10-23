import React from 'react';
import { Text } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { dpaHint } from '@/lib/privacyCenter';
import { useDpaStatus } from '@/hooks/usePrivacyCenter';
import PrivacyCard from './PrivacyCard';

/**
 * Read-only hint on the processor agreement (AV-Vertrag). Only the club owner is asked to act and is sent to the website:
 * reading and signing the contract is not done in the app. Everybody else sees (only while writes are locked) why changes
 * are paused. Silent when nothing is due or the status cannot be read.
 */
export default function DpaHintCard({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { dpa } = useDpaStatus(clubId);
  const hint = dpaHint(dpa);
  if (!hint || !dpa) return null;
  const daysLeft = dpa.status.daysLeft;

  return (
    <PrivacyCard title={t('datenschutz.dpa.title')}>
      {hint === 'owner-confirm' ? (
        <>
          <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold mb-1">{t('datenschutz.dpa.owner')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {dpa.status.blocked ? t('datenschutz.dpa.blocked') : daysLeft !== null && daysLeft >= 0 ? t('datenschutz.dpa.days-left', { count: daysLeft }) : t('datenschutz.dpa.owner-hint')}
          </Text>
        </>
      ) : (
        <Text className="text-foreground dark:text-foreground-dark text-sm">{t('api.error.dpa-required')}</Text>
      )}
    </PrivacyCard>
  );
}
