import React from 'react';
import { Vote } from 'lucide-react-native';
import { View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useBallots } from '@/hooks/useBallots';
import type { BallotSummary } from '@/lib/assembly';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import HeroCard from '@/components/ui/HeroCard';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import Skeleton from '@/components/ui/Skeleton';
import { labelOr } from './ui';

const OUTCOME_TONE: Record<string, BadgeTone> = { angenommen: 'success', entschieden: 'success', abgelehnt: 'neutral', nicht_beschlussfaehig: 'warning', gleichstand: 'warning' };

function Row({ ballot, onPress }: { ballot: BallotSummary; onPress: () => void }) {
  const { t, language } = useLanguage();
  const phase = labelOr(t, `assembly.phase.${ballot.phase}`, 'assembly.phase.other');
  const until = ballot.phase === 'voting' && ballot.closesAt ? t('assembly.closes-at', { when: new Date(ballot.closesAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) }) : null;
  const outcome = ballot.phase === 'ended' ? ballot.result?.outcome : null;
  const hint = [phase, ballot.secret ? t('assembly.secret') : null, until].filter(Boolean).join(' · ');
  return (
    <ListRow
      title={ballot.title}
      hint={hint}
      onPress={onPress}
      trailing={outcome ? <Badge tone={OUTCOME_TONE[outcome] ?? 'neutral'}>{labelOr(t, `assembly.outcome.${outcome}`, 'assembly.outcome.other')}</Badge> : undefined}
    />
  );
}

/** Votes and elections of the club: the open one as hero (they are the reason people come here), then open and finished ones as grouped lists. */
export default function BallotListView({ clubId, onSelect }: { clubId: string; onSelect: (id: string) => void }) {
  const { t, language } = useLanguage();
  const { ballots, loading, error, reload } = useBallots(clubId);
  if (loading && ballots.length === 0) return <Skeleton shape="hero" />;
  if (error && ballots.length === 0) return <ErrorState error={error} fallbackKey="assembly.list.error" onRetry={() => void reload()} />;
  const open = ballots.filter((b) => b.phase === 'voting' || b.phase === 'scheduled');
  const rest = ballots.filter((b) => b.phase !== 'voting' && b.phase !== 'scheduled' && b.phase !== 'draft');
  if (open.length === 0 && rest.length === 0) {
    return <EmptyState icon={Vote} title={t('assembly.list.empty')} hint={t('assembly.list.empty-hint')} />;
  }
  const running = open.find((b) => b.phase === 'voting') ?? null;
  return (
    <>
      {running ? (
        <View className="mb-6">
          <HeroCard
            eyebrow={t('assembly.phase.voting')}
            title={running.title}
            meta={[running.closesAt ? t('assembly.closes-at', { when: new Date(running.closesAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) }) : null, running.secret ? t('assembly.secret') : null].filter(Boolean).join(' · ')}
          >
            <Button variant="inverse" label={t('assembly.hero.open')} onPress={() => onSelect(running.id)} />
          </HeroCard>
        </View>
      ) : null}
      <ListSection title={t('assembly.list.open')}>
        {open.length === 0 ? <ListRow title={t('assembly.list.none-open')} /> : open.map((b) => <Row key={b.id} ballot={b} onPress={() => onSelect(b.id)} />)}
      </ListSection>
      {rest.length > 0 ? (
        <ListSection title={t('assembly.list.done')}>
          {rest.map((b) => (
            <Row key={b.id} ballot={b} onPress={() => onSelect(b.id)} />
          ))}
        </ListSection>
      ) : null}
    </>
  );
}
