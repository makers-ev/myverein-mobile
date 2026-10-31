import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { navigate } from '@/navigation/navigationRef';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useClubApplications } from '@/hooks/useClubApplications';
import ListRow from '@/components/ui/ListRow';
import { CardCheckEntry } from '@/components/documents/DocumentsEntry';
import MemberStatsCard from './MemberStatsCard';
import ExitRequestsQueue from './ExitRequestsQueue';

/** True when the role-dependent "Verwaltung" entry has anything to show (board roles only, deny by default). */
export function canSeeVerwaltung(can: (p: 'members:write' | 'members:read_sensitive' | 'club_stats:read' | 'forms:write') => boolean): boolean {
  return can('members:write') || can('club_stats:read') || can('forms:write');
}

/** Row to the join applications with the number of open ones. */
function ApplicationsEntry({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { applications, total, loading, error } = useClubApplications(clubId);
  const hint = error
    ? t('admin.applications.hint-error')
    : loading && applications.length === 0
      ? undefined
      : total === 0
        ? t('admin.applications.hint-zero')
        : t('admin.applications.hint', { count: total });
  return <ListRow title={t('verein.applications.open')} hint={hint} onPress={() => navigate('ClubApplications')} />;
}

/**
 * Role-dependent "Verwaltung" section of the Verein tab (Wave 7 M9, placed by Wave 14 N1 instead of a sixth tab):
 * join applications, exit-request queue, member list and KPIs, each
 * gated by `permissions` (`members:write` / `club_stats:read`). Create/edit/
 * import stay on the website.
 */
export default function VerwaltungTab({ clubId, onOpenMembers }: { clubId: string; onOpenMembers: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { membership, can, loading } = useOwnMembership(clubId);

  if (loading && !membership) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }
  if (!canSeeVerwaltung(can)) {
    return <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.applications.forbidden')}</Text>;
  }

  return (
    <>
      {can('members:write') ? <ApplicationsEntry clubId={clubId} /> : null}
      {can('members:write') || can('members:read_sensitive') ? <ListRow title={t('admin.members.open')} hint={t('admin.members.hint')} onPress={onOpenMembers} /> : null}
      {can('forms:write') ? <ListRow title={t('forms.pm.title')} hint={t('forms.pm.entry.hint')} onPress={() => navigate('ProfileModules')} /> : null}
      {can('members:write') ? <ExitRequestsQueue clubId={clubId} ownMemberId={membership?.memberId ?? null} /> : null}
      <CardCheckEntry clubId={clubId} />
      {can('assembly:manage') ? (
        <>
          <ListRow title={t('assembly.dashboard.Abstimmungen')} onPress={() => navigate('Abstimmungen')} />
          <ListRow title={t('assembly.dashboard.Versammlung')} onPress={() => navigate('Versammlung')} />
        </>
      ) : null}
      {can('club_stats:read') ? <MemberStatsCard clubId={clubId} /> : null}
    </>
  );
}
