import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { useClubInfo } from '@/hooks/useClubInfo';
import { useCalendars } from '@/hooks/useCalendars';
import { useEvents, useEventRsvp, type CalendarEvent } from '@/hooks/useEvents';
import { getDepartmentColor } from '@/theme/departmentColors';

interface Props {
  clubId: string;
}

// Caller's own RSVP status isn't in the GET /events response (see backend
// notes) -- tracked client-side after a successful rsvp()/cancelRsvp() call
// rather than re-derived from a response shape that doesn't exist yet.
type RsvpState = 'angemeldet' | 'warteliste' | null;

function EventRow({
  event,
  color,
  rsvpState,
  onRsvp,
  onCancel,
  isRsvping,
}: {
  event: CalendarEvent;
  color: string;
  rsvpState: RsvpState;
  onRsvp: () => void;
  onCancel: () => void;
  isRsvping: boolean;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  const timeRange = `${startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endsAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  return (
    <View className="flex-row bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl mb-3 overflow-hidden">
      <View style={{ width: 4, backgroundColor: color }} />
      <View className="flex-1 p-3">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">{event.title}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{timeRange}</Text>

        <View className="flex-row items-center flex-wrap mt-2" style={{ gap: 6 }}>
          {event.category && (
            <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{event.category}</Text>
            </View>
          )}
          {event.capacity != null && (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
              {t('termine.capacity', { capacity: event.capacity })}
            </Text>
          )}
        </View>

        <View className="mt-3">
          {rsvpState ? (
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Text className="text-success dark:text-success-dark text-xs font-semibold">
                {rsvpState === 'angemeldet' ? t('termine.rsvp.confirmed') : t('termine.rsvp.waitlist')}
              </Text>
              <TouchableOpacity onPress={onCancel} disabled={isRsvping}>
                <Text className="text-destructive text-xs font-semibold">{t('termine.cancel')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              className={`bg-primary dark:bg-primary-dark rounded-lg py-2 px-4 items-center self-start ${isRsvping ? 'opacity-70' : ''}`}
              onPress={onRsvp}
              disabled={isRsvping}
            >
              {isRsvping ? (
                <ActivityIndicator color={themeColors.primaryForeground} size="small" />
              ) : (
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">{t('termine.rsvp')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function TermineTab({ clubId }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { info } = useClubInfo(clubId);
  const { calendars } = useCalendars(clubId);
  const { events, loading, refetch } = useEvents(clubId);
  const { rsvp, cancelRsvp } = useEventRsvp(clubId, refetch);

  const [rsvpStates, setRsvpStates] = useState<Record<string, RsvpState>>({});
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleRsvp = async (eventId: string) => {
    setPendingIds((prev) => ({ ...prev, [eventId]: true }));
    setError(null);
    try {
      const status = await rsvp(eventId);
      setRsvpStates((prev) => ({ ...prev, [eventId]: status }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setPendingIds((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const handleCancel = async (eventId: string) => {
    setPendingIds((prev) => ({ ...prev, [eventId]: true }));
    setError(null);
    try {
      await cancelRsvp(eventId);
      setRsvpStates((prev) => ({ ...prev, [eventId]: null }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setPendingIds((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  // calendarId -> department color, resolved once per render via each
  // calendar's departmentId position in useClubInfo's departments array.
  const colorByCalendarId = useMemo(() => {
    const departments = info?.departments ?? [];
    const map = new Map<string, string>();
    for (const cal of calendars) {
      const index = cal.departmentId ? departments.findIndex((d) => d.id === cal.departmentId) : -1;
      map.set(cal.id, getDepartmentColor(index === -1 ? null : index));
    }
    return map;
  }, [calendars, info]);

  const groups = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const byDay = new Map<string, CalendarEvent[]>();
    for (const event of sorted) {
      const dayKey = new Date(event.startsAt).toDateString();
      const list = byDay.get(dayKey) ?? [];
      list.push(event);
      byDay.set(dayKey, list);
    }
    return Array.from(byDay.entries());
  }, [events]);

  if (loading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  if (events.length === 0) {
    return <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('termine.empty')}</Text>;
  }

  return (
    <>
      {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}
      {groups.map(([dayKey, dayEvents]) => (
        <View key={dayKey} className="mb-4">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mb-2">
            {new Date(dayEvents[0].startsAt).toLocaleDateString(language, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          {dayEvents.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              color={colorByCalendarId.get(event.calendarId) ?? getDepartmentColor(null)}
              rsvpState={rsvpStates[event.id] ?? null}
              isRsvping={!!pendingIds[event.id]}
              onRsvp={() => void handleRsvp(event.id)}
              onCancel={() => void handleCancel(event.id)}
            />
          ))}
        </View>
      ))}
    </>
  );
}
