import React from 'react';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import type { TodayBoard } from '@/lib/today';

/**
 * "Für den Vorstand": one grouped list. Open applications and exit requests are summed into ONE row with the red
 * attention count (a decision is needed from the board); maintenance and the member count are quiet values. The server
 * only sends the keys the caller holds the permission for, so a plain member never sees this section (the whole
 * `board` object is absent) and nothing is decided on the device.
 */
export default function BoardSection({ board }: { board: TodayBoard }) {
  const { t } = useLanguage();
  const apps = board.openApplications ?? 0;
  const exits = board.openExits ?? 0;
  const requests = apps + exits;
  return (
    <ListSection title={t('today.board.title')}>
      {requests > 0 ? (
        <ListRow
          key="requests"
          title={t('today.board.requests')}
          hint={t('today.board.requests.hint')}
          count={requests}
          countTone="attention"
          // Applications only: straight to the review list; anything with exits: the Verwaltung tab lists both.
          onPress={() => (exits > 0 ? navigate('Verein', { tab: 'verwaltung' }) : navigate('ClubApplications'))}
        />
      ) : null}
      {board.maintenanceDue && board.maintenanceDue > 0 ? (
        <ListRow key="m" title={t('today.board.maintenance')} value={String(board.maintenanceDue)} onPress={() => navigate('Standorte', { tab: 'material' })} />
      ) : null}
      {typeof board.memberCount === 'number' ? (
        <ListRow key="k" title={t('today.board.members')} value={String(board.memberCount)} onPress={() => navigate('Verein', { tab: 'mitglieder' })} />
      ) : null}
    </ListSection>
  );
}
