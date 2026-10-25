import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ClipboardCheck } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import type { CalendarEvent } from '@/hooks/useEvents';
import type { ClubMember } from '@/hooks/useClubMembers';
import { canOnEvent } from '@/lib/eventRights';

/** The sub-sheets reachable from the event detail; the owner (TermineTab) swaps the event sheet for the chosen one. */
export type EventSubSheetKind = 'attendance';

interface Props {
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

/** Rights-gated shortcuts of the event detail (Wave 12 M7): each one only when the permission is held for this event's scope. */
export default function EventActions({ event, calendarDepartmentId, membership, onOpen }: Props) {
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
  if (items.length === 0) return null;
  return <View style={{ gap: 8 }}>{items}</View>;
}
