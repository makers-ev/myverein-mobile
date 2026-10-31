import React, { useState } from 'react';
import { Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useAssembly } from '@/hooks/useAssembly';
import { useClubMemberDirectory } from '@/hooks/useClubMembers';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import CheckInSection from './CheckInSection';
import { Badge, Body, Button, Card, ErrorRetry, Loading, labelOr } from './ui';

interface Props {
  clubId: string;
  meetingId: string;
  onBack: () => void;
  onOpenBallot: (id: string) => void;
}

/**
 * One general assembly (Wave 11 M2/M3/M4) for members: invitation and agenda, RSVP, proxy, online participation, live quorum,
 * the votes of the meeting, approved minutes. The check-in list appears only with `assembly:manage` / `meetings:write`.
 */
export default function AssemblyDetailView({ clubId, meetingId, onBack, onOpenBallot }: Props) {
  const { t, language } = useLanguage();
  const a = useAssembly(clubId, meetingId);
  const { membership, can } = useOwnMembership(clubId);
  const { members } = useClubMemberDirectory(clubId);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = membership?.id ?? null;
  const manage = can('assembly:manage') || can('meetings:write');

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err, t));
    }
  };

  if (a.meetingLoading && !a.meeting) return <Loading />;
  if (!a.meeting) return <ErrorRetry message={t('assembly.meeting.error')} onRetry={() => void a.reloadAll()} />;
  const m = a.meeting;
  const mine = a.invitees.find((i) => i.clubMemberId === me);
  const grantedByMe = a.proxies.find((p) => p.grantorClubMemberId === me);
  const heldByMe = a.proxies.filter((p) => p.holderClubMemberId === me);
  const content = a.invitation?.content;
  const over = m.status === 'abgehalten' || m.status === 'protokolliert';
  const online = m.participationMode && m.participationMode !== 'praesenz';
  const needle = search.trim().toLocaleLowerCase();
  const holders = members
    .filter((x) => x.id !== me)
    .map((x) => ({ id: x.id, name: x.displayName ?? x.name ?? '' }))
    .filter((x) => x.name && (!needle || x.name.toLocaleLowerCase().includes(needle)))
    .slice(0, 30);
  const agenda = a.agenda.length > 0 ? a.agenda.map((i) => ({ key: i.id, position: i.position, title: i.title, description: i.description })) : (content?.agenda ?? []).map((i) => ({ key: String(i.position), position: i.position, title: i.title, description: i.description }));
  const approved = a.minutes?.current?.approved ? a.minutes.current : null;

  const joinOnline = async () => {
    setError(null);
    try {
      await a.joinOnline();
    } catch (err) {
      setError(apiErrorMessage(err, t));
      return;
    }
    // Only after the join was recorded; a link that cannot be opened is a message, not a crash.
    if (m.onlineUrl && /^https:\/\//i.test(m.onlineUrl)) {
      try {
        await Linking.openURL(m.onlineUrl);
      } catch {
        setError(t('assembly.online.open-failed'));
      }
    }
  };

  return (
    <View>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} className="min-h-[44px] justify-center self-start mb-2">
        <Text className="text-primary dark:text-primary-dark font-semibold">{t('assembly.back')}</Text>
      </TouchableOpacity>
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-xl font-extrabold mb-1">
        {m.title}
      </Text>
      <Body muted>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString(language, { dateStyle: 'full', timeStyle: 'short' }) : t('treffen.scheduled-at.pending')}</Body>
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive dark:text-destructive-dark text-sm mb-3">
          {error}
        </Text>
      ) : null}

      <Card title={t('assembly.invitation.title')}>
        {a.invitation ? (
          <>
            <Body muted>{t('assembly.invitation.version', { version: a.invitation.version })}</Body>
            {content?.place ? <Body>{t('assembly.invitation.place', { place: content.place })}</Body> : null}
            {content?.message ? <Body>{content.message}</Body> : null}
          </>
        ) : (
          <Body muted>{t('assembly.invitation.none')}</Body>
        )}
        <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mb-1">{t('assembly.agenda')}</Text>
        {agenda.length === 0 ? <Body muted>{content?.agendaText || t('assembly.agenda.empty')}</Body> : agenda.map((i) => <Body key={i.key}>{`${i.position}. ${i.title}${i.description ? ` – ${i.description}` : ''}`}</Body>)}
      </Card>

      {!over && mine ? (
        <Card title={t('assembly.rsvp.title')}>
          <Badge symbol={mine.response === 'zugesagt' ? '✓' : mine.response === 'abgesagt' ? '✕' : '?'} label={labelOr(t, `assembly.rsvp.${mine.response}`, 'assembly.rsvp.other')} />
          <Button label={t('assembly.rsvp.yes')} secondary={mine.response !== 'zugesagt'} busy={a.acting} onPress={() => void run(() => a.respond('zugesagt'))} />
          <Button label={t('assembly.rsvp.no')} secondary={mine.response !== 'abgesagt'} busy={a.acting} onPress={() => void run(() => a.respond('abgesagt'))} />
        </Card>
      ) : null}

      {!over && m.type === 'mitgliederversammlung' ? (
        <Card title={t('assembly.proxy.title')}>
          {a.roll ? <Body muted>{a.roll.eligible ? t('assembly.roll.eligible') : t('assembly.roll.not-eligible')}</Body> : null}
          {grantedByMe ? (
            <>
              <Body>{t('assembly.proxy.given', { name: grantedByMe.holderName ?? t('assembly.unknown-person') })}</Body>
              <Button secondary label={t('assembly.proxy.revoke')} busy={a.acting} onPress={() => void run(() => a.revokeProxy(me!))} />
            </>
          ) : chosen ? (
            <>
              <Body>{t('assembly.proxy.confirm', { name: chosen.name })}</Body>
              <Body muted>{t('assembly.proxy.confirm-hint')}</Body>
              <Button
                label={t('assembly.proxy.confirm-submit')}
                busy={a.acting}
                onPress={async () => {
                  const h = chosen;
                  await run(() => a.grantProxy(h.id));
                  setChosen(null);
                  setPicking(false);
                  setSearch('');
                }}
              />
              <Button secondary label={t('assembly.cancel')} disabled={a.acting} onPress={() => setChosen(null)} />
            </>
          ) : picking ? (
            <>
              <Body muted>{t('assembly.proxy.pick')}</Body>
              <TextInput
                accessibilityLabel={t('assembly.checkin.search')}
                placeholder={t('assembly.checkin.search')}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-2 min-h-[48px]"
              />
              {holders.length === 0 ? <Body muted>{t('assembly.proxy.no-members')}</Body> : null}
              {holders.map((h) => (
                <Button key={h.id} secondary label={h.name} disabled={a.acting} onPress={() => setChosen({ id: h.id, name: h.name })} />
              ))}
              <Button secondary label={t('assembly.cancel')} onPress={() => setPicking(false)} />
            </>
          ) : (
            <Button secondary label={t('assembly.proxy.give')} disabled={!me || a.roll?.eligible === false} onPress={() => setPicking(true)} />
          )}
          {heldByMe.length > 0 ? <Body>{t('assembly.proxy.held', { names: heldByMe.map((p) => p.grantorName ?? t('assembly.unknown-person')).join(', ') })}</Body> : null}
        </Card>
      ) : null}

      {online && !over ? (
        <Card title={t('assembly.online.title')}>
          <Body muted>{t('assembly.online.hint')}</Body>
          <Button label={t('assembly.online.join')} busy={a.acting} onPress={() => void joinOnline()} />
          <Button secondary label={t('assembly.online.leave')} busy={a.acting} onPress={() => void run(a.leaveOnline)} />
        </Card>
      ) : null}

      {a.quorum && !over ? (
        <Card title={t('assembly.quorum.title')}>
          <Badge symbol={a.quorum.result === 'beschlussfaehig' ? '✓' : '!'} label={t(`assembly.quorum.${a.quorum.result}`)} />
          <Body muted>{t('assembly.quorum.counts', { present: a.quorum.represented, eligible: a.quorum.eligibleTotal })}</Body>
        </Card>
      ) : null}

      <Card title={t('assembly.ballots.title')}>
        {a.ballotsError && a.ballots.length === 0 ? <Body muted>{t('assembly.list.error')}</Body> : a.ballots.filter((b) => b.phase !== 'draft').length === 0 ? <Body muted>{t('assembly.meeting.no-ballots')}</Body> : null}
        {a.ballots
          .filter((b) => b.phase !== 'draft')
          .map((b) => (
            <Button key={b.id} secondary label={`${b.title} (${labelOr(t, `assembly.phase.${b.phase}`, 'assembly.phase.other')})`} onPress={() => onOpenBallot(b.id)} />
          ))}
      </Card>

      {manage ? <CheckInSection clubId={clubId} meetingId={meetingId} /> : null}

      <Card title={t('assembly.minutes.title')}>
        {approved ? (
          <>
            <Badge symbol="✓" label={t('assembly.minutes.approved')} />
            <Body>{approved.content}</Body>
            {(a.minutes?.amendments ?? []).map((x) => (
              <Body key={x.id} muted>{t('assembly.minutes.amendment', { note: x.note })}</Body>
            ))}
          </>
        ) : (
          <Body muted>{over ? t('assembly.minutes.not-approved') : t('assembly.minutes.later')}</Body>
        )}
      </Card>
    </View>
  );
}
