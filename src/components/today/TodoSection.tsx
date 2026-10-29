import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import ListRow from '@/components/ui/ListRow';
import type { Today } from '@/lib/today';

function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="text-primary dark:text-primary-dark text-xs font-bold uppercase tracking-wider mb-2 mt-1">
      {children}
    </Text>
  );
}

/**
 * "Das steht an": missing answers, cancellations, unread messages, returns that are due and open votes, each one tap
 * from where it is handled. Only what the server sent is shown, so nothing here is an admin function.
 */
export default function TodoSection({ today }: { today: Today }) {
  const { t, language } = useLanguage();
  const when = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}`;
  };
  const day = (iso: string) => new Date(iso).toLocaleDateString(language, { day: 'numeric', month: 'short' });
  // Overdue relative to when the server built the list (also keeps render pure).
  const now = Date.parse(today.generatedAt);

  return (
    <View>
      {today.openRsvps.length > 0 ? <Heading>{t('today.rsvp')}</Heading> : null}
      {today.openRsvps.map((e) => (
        <ListRow key={`r-${e.eventId}`} title={e.title} hint={`${when(e.startsAt)}. ${t('today.rsvp.hint')}`} onPress={() => navigate('Kalender', { tab: 'termine', eventId: e.eventId })} />
      ))}

      {today.cancelled.length > 0 ? <Heading>{t('today.cancelled')}</Heading> : null}
      {today.cancelled.map((e) => (
        <ListRow key={`c-${e.eventId}`} title={e.title} hint={`${when(e.startsAt)}. ${t('today.cancelled.hint')}`} onPress={() => navigate('Kalender', { tab: 'termine', eventId: e.eventId })} />
      ))}

      {today.unreadAnnouncements > 0 ? (
        <>
          <Heading>{t('today.messages')}</Heading>
          <ListRow title={t('today.messages')} hint={t('today.messages.count', { count: today.unreadAnnouncements })} onPress={() => navigate('Mitteilungen')} />
        </>
      ) : null}

      {today.dueReturns.length > 0 ? <Heading>{t('today.returns')}</Heading> : null}
      {today.dueReturns.map((l) => (
        <ListRow
          key={`l-${l.loanId}`}
          title={l.itemName}
          hint={new Date(l.dueAt).getTime() < now ? t('today.returns.overdue', { date: day(l.dueAt) }) : t('today.returns.due', { date: day(l.dueAt) })}
          onPress={() => navigate('Standorte', { tab: 'material' })}
        />
      ))}

      {today.openBallots > 0 ? (
        <>
          <Heading>{t('today.ballots')}</Heading>
          <ListRow title={t('today.ballots')} hint={t('today.ballots.count', { count: today.openBallots })} onPress={() => navigate('Abstimmungen')} />
        </>
      ) : null}
    </View>
  );
}
