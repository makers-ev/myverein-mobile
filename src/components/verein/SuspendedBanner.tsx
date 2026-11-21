import React from 'react';
import { View } from 'react-native';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import Banner from '@/components/ui/Banner';

/**
 * Calm notice for a club the platform suspended (Wave 15 B7), shown from `GET /my-clubs` `suspended` before any club route
 * answers `403 CLUB_SUSPENDED`. Fixed app text only: the server's reason/notes never reach the UI. Renders nothing otherwise.
 */
export default function SuspendedBanner() {
  const { t } = useLanguage();
  const { activeClub } = useActiveClub();
  if (activeClub?.suspended !== true) return null;
  return (
    <View className="px-4 mb-4" accessibilityLiveRegion="polite">
      <Banner tone="warning" title={t('club.suspended.title')} body={t('club.suspended.body')} />
    </View>
  );
}
