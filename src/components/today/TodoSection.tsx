import React from 'react';
import { Ban, CalendarClock, Megaphone, Package, Vote } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import type { Today } from '@/lib/today';

interface Props {
  today: Today;
  /** Title of the newest unread message (shown once, as the preview of the Mitteilungen row). */
  latestMessageTitle?: string | null;
  /** The event shown in the hero card: not repeated here. */
  heroEventId?: string | null;
  /** Open votes are already the hero: not repeated here. */
  hideBallots?: boolean;
}

/**
 * "Das steht an": missing answers, cancellations, unread messages, returns that are due and open votes, each one tap
 * from where it is handled, as ONE grouped list (no repeated headings). Only what the server sent is shown, so nothing
 * here is an admin function.
 */
export default function TodoSection({ today, latestMessageTitle, heroEventId, hideBallots }: Props) {
  const { t, language } = useLanguage();
  const when = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}`;
  };
  const day = (iso: string) => new Date(iso).toLocaleDateString(language, { day: 'numeric', month: 'short' });
  // Overdue relative to when the server built the list (also keeps render pure).
  const now = Date.parse(today.generatedAt);
  const unread = today.unreadAnnouncements;

  return (
    <ListSection title={t('today.section.todo')} inset={60}>
      {today.openRsvps
        .filter((e) => e.eventId !== heroEventId)
        .map((e) => (
          <ListRow key={`r-${e.eventId}`} icon={CalendarClock} title={e.title} hint={`${when(e.startsAt)} · ${t('today.rsvp')}`} onPress={() => navigate('Kalender', { tab: 'termine', eventId: e.eventId })} />
        ))}
      {today.cancelled.map((e) => (
        <ListRow key={`c-${e.eventId}`} icon={Ban} title={e.title} hint={`${when(e.startsAt)} · ${t('today.cancelled')}`} onPress={() => navigate('Kalender', { tab: 'termine', eventId: e.eventId })} />
      ))}
      {unread > 0 ? (
        <ListRow
          key="messages"
          icon={Megaphone}
          title={t('today.messages.title')}
          hint={latestMessageTitle ? t('today.messages.latest', { count: unread, title: latestMessageTitle }) : t('today.messages.count', { count: unread })}
          onPress={() => navigate('Mitteilungen')}
        />
      ) : null}
      {today.dueReturns.map((l) => (
        <ListRow
          key={`l-${l.loanId}`}
          icon={Package}
          title={l.itemName}
          hint={new Date(l.dueAt).getTime() < now ? t('today.returns.overdue', { date: day(l.dueAt) }) : t('today.returns.due', { date: day(l.dueAt) })}
          onPress={() => navigate('Standorte', { tab: 'material' })}
        />
      ))}
      {!hideBallots && today.openBallots > 0 ? (
        <ListRow key="ballots" icon={Vote} title={t('today.ballots')} hint={t('today.ballots.count', { count: today.openBallots })} onPress={() => navigate('Abstimmungen')} />
      ) : null}
    </ListSection>
  );
}
