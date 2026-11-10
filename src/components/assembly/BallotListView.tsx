import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useBallots } from '@/hooks/useBallots';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import type { BallotSummary } from '@/lib/assembly';
import { Badge, Body, Card, ErrorRetry, Loading, labelOr } from './ui';

const SYMBOL: Record<string, string> = { scheduled: '⏳', voting: '●', ended: '✓', cancelled: '✕', draft: '…' };

function Row({ ballot, onPress }: { ballot: BallotSummary; onPress: () => void }) {
  const { t, language } = useLanguage();
  const phase = labelOr(t, `assembly.phase.${ballot.phase}`, 'assembly.phase.other');
  const until = ballot.phase === 'voting' && ballot.closesAt ? t('assembly.closes-at', { when: new Date(ballot.closesAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) }) : null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={[ballot.title, phase, until].filter(Boolean).join(', ')}
      onPress={onPress}
      className="min-h-[64px] bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] p-4 mb-2"
    >
      <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold mb-2">{ballot.title}</Text>
      {/* Status as line icon + word (never a text glyph, never colour alone). */}
      <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
        <Badge symbol={SYMBOL[ballot.phase] ?? '…'} label={phase} />
        {ballot.secret ? <Badge symbol="lock" label={t('assembly.secret')} /> : null}
      </View>
      {until ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]" style={{ fontVariant: ['tabular-nums'] }}>
          {until}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

/** Votes and elections of the club: open ones first (they are the reason people come here), then the finished ones. */
export default function BallotListView({ clubId, onSelect }: { clubId: string; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  const { ballots, loading, error, reload } = useBallots(clubId);
  if (loading && ballots.length === 0) return <Loading />;
  if (error && ballots.length === 0) return <ErrorRetry message={apiErrorMessage(error, t, 'assembly.list.error')} onRetry={() => void reload()} />;
  const open = ballots.filter((b) => b.phase === 'voting' || b.phase === 'scheduled');
  const rest = ballots.filter((b) => b.phase !== 'voting' && b.phase !== 'scheduled' && b.phase !== 'draft');
  if (open.length === 0 && rest.length === 0) {
    return (
      <Card>
        <Body>{t('assembly.list.empty')}</Body>
        <Body muted>{t('assembly.list.empty-hint')}</Body>
      </Card>
    );
  }
  return (
    <>
      <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 px-1">
        {t('assembly.list.open')}
      </Text>
      {open.length === 0 ? <Body muted>{t('assembly.list.none-open')}</Body> : open.map((b) => <Row key={b.id} ballot={b} onPress={() => onSelect(b.id)} />)}
      {rest.length > 0 ? (
        <>
          <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mt-6 mb-2 px-1">
            {t('assembly.list.done')}
          </Text>
          {rest.map((b) => (
            <Row key={b.id} ballot={b} onPress={() => onSelect(b.id)} />
          ))}
        </>
      ) : null}
    </>
  );
}
