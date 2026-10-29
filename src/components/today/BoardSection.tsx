import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import ListRow from '@/components/ui/ListRow';
import type { TodayBoard } from '@/lib/today';

/**
 * Board to-dos and the member count. The server only sends the keys the caller holds the permission for, so a plain
 * member never sees this section (the whole `board` object is absent) and nothing is decided on the device.
 */
export default function BoardSection({ board }: { board: TodayBoard }) {
  const { t } = useLanguage();
  const rows: React.ReactNode[] = [];
  if (board.openApplications && board.openApplications > 0) {
    rows.push(<ListRow key="a" title={t('today.board.applications')} badge={board.openApplications} onPress={() => navigate('ClubApplications')} />);
  }
  if (board.openExits && board.openExits > 0) {
    rows.push(<ListRow key="e" title={t('today.board.exits')} badge={board.openExits} onPress={() => navigate('Verein', { tab: 'verwaltung' })} />);
  }
  if (board.maintenanceDue && board.maintenanceDue > 0) {
    rows.push(<ListRow key="m" title={t('today.board.maintenance')} badge={board.maintenanceDue} onPress={() => navigate('Standorte', { tab: 'material' })} />);
  }
  if (typeof board.memberCount === 'number') {
    rows.push(<ListRow key="k" title={t('today.board.members')} hint={t('today.board.members.count', { count: board.memberCount })} onPress={() => navigate('Verein', { tab: 'mitglieder' })} />);
  }
  if (rows.length === 0) return null;
  return (
    <View>
      <Text accessibilityRole="header" className="text-primary dark:text-primary-dark text-xs font-bold uppercase tracking-wider mb-2 mt-1">
        {t('today.board.title')}
      </Text>
      {rows}
    </View>
  );
}
