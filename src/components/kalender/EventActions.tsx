import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Car, ClipboardCheck, HandHelping, Timer } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import type { CalendarEvent } from '@/hooks/useEvents';
import type { ClubMember } from '@/hooks/useClubMembers';
import { canOnEvent, canTrackTime } from '@/lib/eventRights';
import { useEventHelpers } from '@/hooks/useEventHelpers';
import { openShiftCount, totalShifts } from '@/lib/helpers';
import { useEventRides } from '@/hooks/useEventRides';
import { totalFreeSeats } from '@/lib/rides';

/** The sub-sheets reachable from the event detail; the owner (TermineTab) swaps the event sheet for the chosen one. */
export type EventSubSheetKind = 'attendance' | 'helpers' | 'rides' | 'time';

interface Props {
  clubId: string;
  event: CalendarEvent;
  /** `departmentId` of the event's calendar (`null` = club-wide calendar). */
  calendarDepartmentId: string | null;
  membership: Pick<ClubMember, 'roles' | 'permissions'> | null;
  onOpen: (kind: EventSubSheetKind) => void;
}

function ActionButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center border border-border dark:border-border-dark rounded-xl px-3"
      style={{ minHeight: 48, gap: 8 }}
    >
      {icon}
      <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm font-semibold">{label}</Text>
    </TouchableOpacity>
  );
}

/** "Helferschichten": only offered when the event has a plan (or the caller manages it); shows how many shifts still need people. */
function HelpersAction({ clubId, event, onOpen }: { clubId: string; event: CalendarEvent; onOpen: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { data: plan } = useEventHelpers(clubId, event.id);
  if (!plan || (totalShifts(plan) === 0 && !plan.canManage)) return null;
  const open = openShiftCount(plan);
  const mine = plan.mine.length;
  const hint = mine > 0 ? t('help.action.mine', { count: mine }) : open > 0 ? t('help.action.open', { count: open }) : totalShifts(plan) === 0 ? t('help.action.none') : t('help.action.covered');
  return (
    <TouchableOpacity
      onPress={onOpen}
      accessibilityRole="button"
      className="flex-row items-center border border-border dark:border-border-dark rounded-xl px-3"
      style={{ minHeight: 48, gap: 8 }}
    >
      <HandHelping size={18} color={themeColors.foreground} />
      <View className="flex-1 py-2">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('help.open')}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** "Fahrgemeinschaften": offered whenever the rides can be read (members; external guests get nothing), with the free seats as hint. */
function RidesAction({ clubId, event, onOpen }: { clubId: string; event: CalendarEvent; onOpen: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { data } = useEventRides(clubId, event.id);
  if (!data) return null;
  const free = totalFreeSeats(data);
  return (
    <TouchableOpacity
      onPress={onOpen}
      accessibilityRole="button"
      className="flex-row items-center border border-border dark:border-border-dark rounded-xl px-3"
      style={{ minHeight: 48, gap: 8 }}
    >
      <Car size={18} color={themeColors.foreground} />
      <View className="flex-1 py-2">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('ride.open')}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {data.rides.length === 0 ? t('ride.action.none') : t('ride.action.summary', { rides: data.rides.length, free })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Rights-gated shortcuts of the event detail (Wave 12 M7): each one only when the permission is held for this event's scope. */
export default function EventActions({ clubId, event, calendarDepartmentId, membership, onOpen }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  if (event.cancelled) return null;

  const attendance =
    canOnEvent('attendance:read', membership, calendarDepartmentId) || canOnEvent('attendance:write', membership, calendarDepartmentId);

  const items: React.ReactNode[] = [];
  if (attendance) {
    items.push(
      <ActionButton key="attendance" icon={<ClipboardCheck size={18} color={themeColors.foreground} />} label={t('att.open')} onPress={() => onOpen('attendance')} />,
    );
  }
  if (canTrackTime(membership)) {
    items.push(<ActionButton key="time" icon={<Timer size={18} color={themeColors.foreground} />} label={t('time.open-for-event')} onPress={() => onOpen('time')} />);
  }
  items.push(<HelpersAction key="helpers" clubId={clubId} event={event} onOpen={() => onOpen('helpers')} />);
  items.push(<RidesAction key="rides" clubId={clubId} event={event} onOpen={() => onOpen('rides')} />);
  return <View style={{ gap: 8 }}>{items}</View>;
}
