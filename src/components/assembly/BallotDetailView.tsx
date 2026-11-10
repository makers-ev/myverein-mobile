import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Check, ChevronLeft, Lock } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useBallot } from '@/hooks/useBallots';
import { useScopedResource } from '@/hooks/useScopedResource';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { canSubmitSelection, openProxies, toggleOption, votingOpenFor, type BallotDetail, type BallotOption, type VoteFailure } from '@/lib/assembly';
import { useThemeColors } from '@/theme/colors';
import Banner from '@/components/ui/Banner';
import UiButton from '@/components/ui/Button';
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
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      // radio / checkbox semantics so screen readers announce "selected" without relying on colour.
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={option.label}
      onPress={onPress}
      className={`min-h-[56px] flex-row items-center rounded-[10px] mb-2 ${
        selected ? 'border-primary-text dark:border-primary-text-dark bg-primary-soft dark:bg-primary-soft-dark' : 'border-border-control dark:border-border-control-dark bg-card dark:bg-card-dark'
      }`}
      // 2pt ring when selected, 1pt otherwise; the padding keeps the content from shifting.
      style={{ gap: 12, borderWidth: selected ? 2 : 1, paddingHorizontal: selected ? 15 : 16 }}
    >
      {/* Drawn radio / checkbox (no text glyphs); the selected state is also the thicker ring and the fill. */}
      {multi ? (
        <View
          className={`items-center justify-center rounded-md border-2 ${selected ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border-control dark:border-border-control-dark'}`}
          style={{ width: 24, height: 24 }}
        >
          {selected ? <Check size={16} strokeWidth={2.5} color={colors.primaryForeground} /> : null}
        </View>
      ) : (
        <View
          className={`items-center justify-center rounded-full border-2 ${selected ? 'border-primary-text dark:border-primary-text-dark' : 'border-border-control dark:border-border-control-dark'}`}
          style={{ width: 24, height: 24 }}
        >
          {selected ? <View className="rounded-full bg-primary-text dark:bg-primary-text-dark" style={{ width: 12, height: 12 }} /> : null}
        </View>
      )}
      <Text className={`flex-1 text-[17px] leading-[22px] text-foreground dark:text-foreground-dark ${selected ? 'font-semibold' : ''}`}>{option.label}</Text>
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
  const tallies = r.tallies ?? [];
  const max = Math.max(1, ...tallies.map((tl) => tl.votes));
  return (
    <View>
      {r.outcome ? (
        <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold mb-3">{labelOr(t, `assembly.outcome.${r.outcome}`, 'assembly.outcome.other')}</Text>
      ) : null}
      {/* Plain bars in the primary colour, the number written next to each (no chart dependency, no rainbow). */}
      {tallies.map((tl) => (
        <View key={tl.optionId} accessible accessibilityLabel={`${tl.label}: ${tl.votes}`} className="mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-foreground dark:text-foreground-dark text-[15px] leading-5">{tl.label}</Text>
            <Text className="text-foreground dark:text-foreground-dark text-[15px] leading-5 font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
              {tl.votes}
            </Text>
          </View>
          <View className="bg-muted dark:bg-muted-dark rounded-full overflow-hidden" style={{ height: 8 }}>
            <View className="bg-primary dark:bg-primary-dark rounded-full" style={{ height: 8, width: `${Math.round((tl.votes / max) * 100)}%` }} />
          </View>
        </View>
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
  const colors = useThemeColors();
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
      <View className="self-start mb-1" style={{ marginLeft: -12 }}>
        <UiButton variant="tertiary" size="M" icon={ChevronLeft} label={t('assembly.back')} onPress={onBack} />
      </View>
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold mb-2">
        {ballot.title}
      </Text>
      <Badge symbol={PHASE_SYMBOL[ballot.phase] ?? '•'} label={labelOr(t, `assembly.phase.${ballot.phase}`, 'assembly.phase.other')} />
      {ballot.description ? <Body>{ballot.description}</Body> : null}
      {ballot.meeting ? <Body muted>{ballot.meeting.title}</Body> : null}
      {ballot.mode === 'circular' ? <Body muted>{t('assembly.circular-hint')}</Body> : null}
      {ballot.opensAt && ballot.phase === 'scheduled' ? <Body muted>{t('assembly.opens-at', { when: when(ballot.opensAt, language) })}</Body> : null}
      {ballot.closesAt && (ballot.phase === 'voting' || ballot.phase === 'scheduled') ? <Body muted>{t('assembly.closes-at', { when: when(ballot.closesAt, language) })}</Body> : null}
      {ballot.secret ? (
        <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
          <Lock size={16} strokeWidth={1.75} color={colors.mutedForeground} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium">{t('assembly.secret')}</Text>
        </View>
      ) : null}
      {ballot.electionId ? <Election clubId={clubId} electionId={ballot.electionId} /> : null}

      {failure ? (
        <View className="mb-3">
          <Banner tone="danger" body={failure} />
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

      {ballot.secret ? (
        <View className="mb-4">
          <Banner tone="info" icon={Lock} body={t('assembly.secret-hint')} />
        </View>
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
