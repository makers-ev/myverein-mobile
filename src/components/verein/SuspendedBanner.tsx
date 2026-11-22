import React from 'react';
import { Text, View } from 'react-native';
import { CircleAlert } from 'lucide-react-native';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { cleanSuspensionNote, formatDay } from '@/lib/outreach';

/**
 * Calm notice for a club the platform suspended (Wave 15 B7), from `GET /my-clubs` `suspension` before any club route
 * answers `403 CLUB_SUSPENDED`. A fixed app line, the optional date it started, and the note the platform wrote for the
 * members as plain, selectable text (no markup, capped, wrapped); the internal reason never reaches the app. Renders
 * nothing for an active club.
 */
export default function SuspendedBanner() {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const { activeClub } = useActiveClub();
  const suspension = activeClub?.suspension;
  if (!suspension) return null;
  const note = cleanSuspensionNote(suspension.note);
  const since = formatDay(suspension.since?.slice(0, 10), language);
  const label = [t('club.suspended.title'), since ? t('club.suspended.since', { date: since }) : null, note].filter(Boolean).join('. ');
  return (
    <View className="px-4 mb-4" accessibilityLiveRegion="polite">
      <View accessible accessibilityRole="alert" accessibilityLabel={label} className="rounded-card px-4 py-3 bg-warning-soft dark:bg-warning-soft-dark">
        <View className="flex-row items-start" style={{ gap: 10 }}>
          <View style={{ marginTop: 1 }}>
            <CircleAlert size={20} strokeWidth={1.75} color={colors.warning} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] leading-5 font-semibold text-warning dark:text-warning-dark">{t('club.suspended.title')}</Text>
            {since ? <Text className="text-[13px] leading-[18px] mt-0.5 text-foreground dark:text-foreground-dark">{t('club.suspended.since', { date: since })}</Text> : null}
            {note ? (
              <Text selectable className="text-[15px] leading-5 mt-1 text-foreground dark:text-foreground-dark">
                {note}
              </Text>
            ) : (
              <Text className="text-[15px] leading-5 mt-1 text-foreground dark:text-foreground-dark">{t('club.suspended.body')}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
