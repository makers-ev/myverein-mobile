import React from 'react';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useExpiringTerms } from '@/hooks/useAssembly';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { expiringTerms } from '@/lib/assembly';
import { Body, Card } from './ui';

/**
 * Term notice for board roles (Wave 11 M4): own roles whose term ended or ends within 60 days; with `assembly:manage`
 * additionally the club's expiring roles ("plan an election"). Informational only, the term has no effect on rights by default.
 */
export default function TermHint({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { membership, can } = useOwnMembership(clubId);
  const manage = can('assembly:manage');
  const { roles: club } = useExpiringTerms(clubId, manage);
  const own = expiringTerms(membership?.roles ?? [], new Date());
  if (own.length === 0 && club.length === 0) return null;
  const line = (role: string, daysLeft: number) => t(daysLeft < 0 ? 'assembly.term.over' : 'assembly.term.soon', { role: t(`assembly.role.${role}`), days: Math.abs(daysLeft) });
  return (
    <Card title={t('assembly.term.title')}>
      {own.map((r) => (
        <Body key={r.id}>{line(r.roleType, r.daysLeft)}</Body>
      ))}
      {manage
        ? club.map((r) => (
            <Body key={r.id} muted>
              {`${r.name ?? t('assembly.unknown-person')}: ${line(r.roleType, r.termDaysLeft ?? 0)}`}
            </Body>
          ))
        : null}
      {manage ? <Body muted>{t('assembly.term.plan')}</Body> : null}
    </Card>
  );
}
