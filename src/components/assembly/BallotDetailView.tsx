import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useBallot } from '@/hooks/useBallots';
import { useScopedResource } from '@/hooks/useScopedResource';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { canSubmitSelection, openProxies, toggleOption, votingOpenFor, type BallotDetail, type BallotOption, type VoteFailure } from '@/lib/assembly';
import { Badge, Body, Button, Card, ErrorRetry, Loading, labelOr } from './ui';

interface Props {
  clubId: string;
  ballotId: string;
  onBack: () => void;
}

const PHASE_SYMBOL: Record<string, string> = { scheduled: '⏳', voting: '●', ended: '✓', cancelled: '✕', draft: '…' };

function when(iso: string | null, language: string): string {
  return iso ? new Date(iso).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function OptionRow({ option, selected, multi, onPress }: { option: BallotOption; selected: boolean; multi: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      // radio / checkbox semantics so screen readers announce "selected" without relying on colour.
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={option.label}
      onPress={onPress}
      className={`min-h-[56px] flex-row items-center rounded-xl px-4 mb-2 border-2 ${selected ? 'border-primary dark:border-primary-dark bg-muted dark:bg-muted-dark' : 'border-border dark:border-border-dark bg-card dark:bg-card-dark'}`}
    >
      <Text className="text-lg mr-3 text-foreground dark:text-foreground-dark">{multi ? (selected ? '☑' : '☐') : selected ? '◉' : '○'}</Text>
      <Text className="flex-1 text-base font-semibold text-foreground dark:text-foreground-dark">{option.label}</Text>
    </TouchableOpacity>
  );
}

const FAILURE_KEY: Record<VoteFailure, string> = {
  already_voted: 'assembly.vote.fail.other',
  not_eligible: 'assembly.vote.fail.not-eligible',
  not_checked_in: 'assembly.vote.fail.not-checked-in',
  closed: 'assembly.vote.fail.closed',
  not_started: 'assembly.vote.fail.not-started',
  proxy: 'assembly.vote.fail.proxy',
  rate_limit: 'api.error.rate-limit',
  offline: 'assembly.vote.fail.offline',
  other: 'assembly.vote.fail.other',
};

function Result({ ballot }: { ballot: BallotDetail }) {
  const { t } = useLanguage();
  const r = ballot.result;
  if (!r) return <Body muted>{t('assembly.result.pending')}</Body>;
  return (
    <View>
      {r.outcome ? <Body>{labelOr(t, `assembly.outcome.${r.outcome}`, 'assembly.outcome.other')}</Body> : null}
      {(r.tallies ?? []).map((tl) => (
        <Text key={tl.optionId} className="text-sm text-foreground dark:text-foreground-dark mb-1">{`${tl.label}: ${tl.votes}`}</Text>
      ))}
      {typeof r.participants === 'number' && typeof r.eligible === 'number' ? (
        <Body muted>{t('assembly.result.participation', { voted: r.participants, eligible: r.eligible })}</Body>
      ) : null}
    </View>
  );
}

interface ElectionData {
  seats: number;
  openSeats: number;
  roleType: string;
  candidates: { id: string; displayName: string | null; status: string }[];
}

/** Candidates of the election a ballot round belongs to (members see who stands). */
function Election({ clubId, electionId }: { clubId: string; electionId: string }) {
  const { t } = useLanguage();
  const { data } = useScopedResource<ElectionData>(`/elections/${encodeURIComponent(electionId)}?clubId=${encodeURIComponent(clubId)}`);
  if (!data) return null;
  return (
    <Card title={t('assembly.election.title', { role: labelOr(t, `assembly.role.${data.roleType}`, 'assembly.role.other') })}>
      <Body muted>{t('assembly.election.seats', { seats: data.seats })}</Body>
      {data.candidates.length === 0 ? <Body muted>{t('assembly.election.no-candidates')}</Body> : data.candidates.map((c) => <Body key={c.id}>{c.displayName ?? t('assembly.unknown-person')}</Body>)}
    </Card>
  );
}

/**
 * One vote or election round (Wave 11 M1). Voting takes three taps: pick an option, "Weiter", then the binding confirmation.
 * The server decides everything that matters (window, voter roll, check-in, one vote per person); this screen only mirrors
 * `phase` and `me`. A secret ballot shows no choice afterwards, only that the vote was counted.
 */
export default function BallotDetailView({ clubId, ballotId, onBack }: Props) {
  const { t, language } = useLanguage();
  const { ballot, loading, error, reload, castVote, voting } = useBallot(clubId, ballotId);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [forMember, setForMember] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [justVoted, setJustVoted] = useState(false);

  const canVote = !!ballot && votingOpenFor(ballot);
  const proxies = ballot ? openProxies(ballot) : [];
  // Self already voted but a proxy vote is open: the person keeps voting for the grantor.
  const proxyOnly = !!ballot && ballot.phase === 'voting' && ballot.me.hasVoted && proxies.length > 0;
  const mayChoose = canVote || proxyOnly;

  // Window ended / right lost while choosing: drop the pending choice, the notice below explains why.
  useEffect(() => {
    if (!mayChoose) {
      setConfirming(false);
      setSelected([]);
    }
  }, [mayChoose]);
  useEffect(() => {
    setSelected([]);
    setConfirming(false);
    setFailure(null);
    setJustVoted(false);
    setForMember(null);
  }, [ballotId]);

  if (loading && !ballot) return <Loading />;
  if (!ballot) return <ErrorRetry message={apiErrorMessage(error, t, 'assembly.ballot.error')} onRetry={() => void reload()} />;

  const multi = ballot.maxChoices > 1;
  // A chosen proxy that is gone (voted elsewhere, withdrawn) falls back to the default instead of voting for the wrong person.
  const validProxy = forMember && proxies.some((p) => p.grantorClubMemberId === forMember) ? forMember : null;
  const target = validProxy ?? (canVote ? undefined : (proxies[0]?.grantorClubMemberId ?? undefined));
  const targetName = target ? proxies.find((p) => p.grantorClubMemberId === target)?.displayName : null;
  const labels = ballot.options.filter((o) => selected.includes(o.id)).map((o) => o.label);

  const submit = async () => {
    setFailure(null);
    const out = await castVote(selected, target);
    if (out.ok) {
      setJustVoted(true);
      setConfirming(false);
      setSelected([]);
      setForMember(null);
    } else {
      setConfirming(false);
      setFailure(t(FAILURE_KEY[out.failure]));
    }
  };

  return (
    <View>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} className="min-h-[44px] justify-center self-start mb-2">
        <Text className="text-primary dark:text-primary-dark font-semibold">{t('assembly.back')}</Text>
      </TouchableOpacity>
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-xl font-extrabold mb-2">
        {ballot.title}
      </Text>
      <Badge symbol={PHASE_SYMBOL[ballot.phase] ?? '•'} label={labelOr(t, `assembly.phase.${ballot.phase}`, 'assembly.phase.other')} />
      {ballot.description ? <Body>{ballot.description}</Body> : null}
      {ballot.meeting ? <Body muted>{ballot.meeting.title}</Body> : null}
      {ballot.mode === 'circular' ? <Body muted>{t('assembly.circular-hint')}</Body> : null}
      {ballot.opensAt && ballot.phase === 'scheduled' ? <Body muted>{t('assembly.opens-at', { when: when(ballot.opensAt, language) })}</Body> : null}
      {ballot.closesAt && (ballot.phase === 'voting' || ballot.phase === 'scheduled') ? <Body muted>{t('assembly.closes-at', { when: when(ballot.closesAt, language) })}</Body> : null}
      {ballot.secret ? (
        <Card>
          <Body>{t('assembly.secret-hint')}</Body>
        </Card>
      ) : null}
      {ballot.electionId ? <Election clubId={clubId} electionId={ballot.electionId} /> : null}

      {failure ? (
        <View className="mb-3">
          <Text accessibilityRole="alert" className="text-destructive dark:text-destructive-dark text-sm">
            {failure}
          </Text>
        </View>
      ) : null}

      {justVoted || (ballot.me.hasVoted && !proxyOnly) ? (
        <Card title={t('assembly.voted.title')}>
          <Body>{ballot.secret ? t('assembly.voted.secret') : t('assembly.voted.open')}</Body>
          {!ballot.secret && ballot.me.ownVoteOptionIds ? (
            <Body muted>{ballot.options.filter((o) => ballot.me.ownVoteOptionIds?.includes(o.id)).map((o) => o.label).join(', ')}</Body>
          ) : null}
        </Card>
      ) : null}

      {mayChoose && !confirming ? (
        <Card title={t('assembly.vote.title')}>
          {proxies.length > 0 ? (
            <View className="mb-2">
              <Body muted>{t('assembly.vote.for')}</Body>
              {canVote ? <Button secondary={!!target} label={t('assembly.vote.for-me')} onPress={() => setForMember(null)} /> : null}
              {proxies.map((p) => (
                <Button key={p.grantorClubMemberId} secondary={target !== p.grantorClubMemberId} label={t('assembly.vote.for-proxy', { name: p.displayName ?? t('assembly.unknown-person') })} onPress={() => setForMember(p.grantorClubMemberId)} />
              ))}
            </View>
          ) : null}
          <Body muted>{multi ? t('assembly.vote.pick-many', { count: ballot.maxChoices }) : t('assembly.vote.pick-one')}</Body>
          {ballot.options.map((o) => (
            <OptionRow key={o.id} option={o} multi={multi} selected={selected.includes(o.id)} onPress={() => setSelected((s) => toggleOption(s, o, ballot.options, ballot.maxChoices))} />
          ))}
          <Button label={t('assembly.vote.next')} disabled={!canSubmitSelection(selected, ballot.maxChoices)} onPress={() => setConfirming(true)} />
        </Card>
      ) : null}

      {mayChoose && confirming ? (
        <Card title={t('assembly.confirm.title')}>
          {targetName ? <Body muted>{t('assembly.confirm.for-proxy', { name: targetName })}</Body> : null}
          <Body>{labels.join(', ')}</Body>
          <Body muted>{ballot.secret ? t('assembly.confirm.secret') : t('assembly.confirm.open')}</Body>
          <Button label={t('assembly.confirm.submit')} busy={voting} onPress={() => void submit()} accessibilityHint={t('assembly.confirm.hint')} />
          <Button secondary label={t('assembly.confirm.change')} disabled={voting} onPress={() => setConfirming(false)} />
        </Card>
      ) : null}

      {!mayChoose && !ballot.me.hasVoted && ballot.phase === 'voting' ? (
        <Card>
          <Body>{!ballot.me.eligible ? t('assembly.vote.not-eligible') : ballot.me.checkedIn === false ? t('assembly.vote.not-checked-in') : t('assembly.vote.unavailable')}</Body>
          <Button secondary label={t('connection.retry')} onPress={() => void reload()} />
        </Card>
      ) : null}

      {ballot.phase === 'ended' || ballot.status === 'finalized' ? (
        <Card title={t('assembly.result.title')}>
          <Result ballot={ballot} />
        </Card>
      ) : null}

      {ballot.participation ? (
        <Body muted>{t('assembly.participation', { voted: ballot.participation.voted, eligible: ballot.participation.eligible })}</Body>
      ) : null}
    </View>
  );
}
