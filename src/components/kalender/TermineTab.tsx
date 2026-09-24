import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Plus, Settings2 } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { useClubInfo } from '@/hooks/useClubInfo';
import { useCalendars } from '@/hooks/useCalendars';
import { useEvents, useEventMutations, useEventRsvp, type CalendarEvent, type EventInput } from '@/hooks/useEvents';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { getDepartmentColor } from '@/theme/departmentColors';
import MonthCalendar, { toDayKey } from '@/components/ui/MonthCalendar';
import EventSheet, { formatTimeRange, RsvpControl, type EventSheetTarget, type RsvpProps, type RsvpState } from './EventSheet';
import CalendarManageSheet from './CalendarManageSheet';

interface Props {
  clubId: string;
}

function EventRow({ event, color, rsvp, onPress }: { event: CalendarEvent; color: string; rsvp: RsvpProps; onPress: () => void }) {
  const { t, language } = useLanguage();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl mb-3 overflow-hidden"
    >
      <View style={{ width: 4, backgroundColor: color }} />
      <View className="flex-1 p-3">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">{event.title}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{formatTimeRange(event, language)}</Text>

        {event.category || event.capacity != null ? (
          <View className="flex-row items-center flex-wrap mt-2" style={{ gap: 6 }}>
            {event.category ? (
              <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{event.category}</Text>
              </View>
            ) : null}
            {event.capacity != null ? (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('termine.capacity', { capacity: event.capacity })}</Text>
            ) : null}
          </View>
        ) : null}

        <View className="mt-3">
          <RsvpControl {...rsvp} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Visible grid range (+/- one week around the month) as ISO strings for `GET /events?from=&to=`. */
function monthRange(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth(), -6);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 8);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function TermineTab({ clubId }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { info } = useClubInfo(clubId);
  const { calendars, refetch: refetchCalendars } = useCalendars(clubId);
  const { can } = useOwnMembership(clubId);
  const canWrite = can('calendars:write');

  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => toDayKey(new Date()));
  const range = useMemo(() => monthRange(month), [month]);
  const { events, loading, refetch } = useEvents(clubId, range);
  const { rsvp, cancelRsvp } = useEventRsvp(clubId, refetch);
  const { createEvent, updateEvent, deleteEvent } = useEventMutations(clubId, refetch);

  const [rsvpStates, setRsvpStates] = useState<Record<string, RsvpState>>({});
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [sheetTarget, setSheetTarget] = useState<EventSheetTarget | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const runRsvp = async (eventId: string, action: () => Promise<RsvpState>) => {
    setPendingIds((prev) => ({ ...prev, [eventId]: true }));
    setError(null);
    try {
      const status = await action();
      setRsvpStates((prev) => ({ ...prev, [eventId]: status }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setPendingIds((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const rsvpPropsFor = (eventId: string): RsvpProps => ({
    state: rsvpStates[eventId] ?? null,
    pending: !!pendingIds[eventId],
    onRsvp: () => void runRsvp(eventId, () => rsvp(eventId)),
    onCancel: () => void runRsvp(eventId, async () => (await cancelRsvp(eventId), null)),
  });

  // calendarId -> department color via each calendar's departmentId position in useClubInfo's departments.
  const colorByCalendarId = useMemo(() => {
    const departments = info?.departments ?? [];
    const map = new Map<string, string>();
    for (const cal of calendars) {
      const index = cal.departmentId ? departments.findIndex((d) => d.id === cal.departmentId) : -1;
      map.set(cal.id, getDepartmentColor(index === -1 ? null : index));
    }
    return map;
  }, [calendars, info]);
  const colorFor = useCallback((calendarId: string) => colorByCalendarId.get(calendarId) ?? getDepartmentColor(null), [colorByCalendarId]);

  // ponytail: multi-day events only mark and list on their start day.
  const { markers, byDay } = useMemo(() => {
    const dots: Record<string, string[]> = {};
    const days = new Map<string, CalendarEvent[]>();
    for (const event of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const key = toDayKey(new Date(event.startsAt));
      const color = colorFor(event.calendarId);
      dots[key] = dots[key]?.includes(color) ? dots[key] : [...(dots[key] ?? []), color];
      days.set(key, [...(days.get(key) ?? []), event]);
    }
    return { markers: dots, byDay: days };
  }, [events, colorFor]);

  const dayEvents = byDay.get(selectedDay) ?? [];
  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedDay.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDay]);

  const handleMonthChange = (next: Date) => {
    setMonth(next);
    const today = new Date();
    const sameMonth = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth();
    setSelectedDay(toDayKey(sameMonth ? today : new Date(next.getFullYear(), next.getMonth(), 1)));
  };

  const handleSelectDay = (key: string, date: Date) => {
    // A second tap on the selected day starts a new event there.
    if (key === selectedDay && canWrite) setSheetTarget({ day: date });
    setSelectedDay(key);
    if (date.getMonth() !== month.getMonth()) setMonth(date);
  };

  const handleSave = async (input: EventInput, id?: string) => {
    if (id) await updateEvent(id, input);
    else await createEvent(input);
  };

  const handleCalendarsChanged = useCallback(() => {
    void refetchCalendars();
    void refetch();
  }, [refetchCalendars, refetch]);

  const sheetEvent = sheetTarget && 'eventId' in sheetTarget ? (events.find((e) => e.id === sheetTarget.eventId) ?? null) : null;

  return (
    <>
      {canWrite ? (
        <View className="flex-row mb-3" style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => setManageOpen(true)}
            className="flex-1 flex-row items-center justify-center border border-border dark:border-border-dark rounded-xl py-2.5"
            style={{ gap: 6 }}
          >
            <Settings2 size={16} color={themeColors.foreground} />
            <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('kalender.manage.open')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSheetTarget({ day: selectedDate })}
            className="flex-1 flex-row items-center justify-center bg-primary dark:bg-primary-dark rounded-xl py-2.5"
            style={{ gap: 6 }}
          >
            <Plus size={16} color={themeColors.primaryForeground} />
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('termine.new')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <MonthCalendar month={month} onMonthChange={handleMonthChange} selectedDay={selectedDay} onSelectDay={handleSelectDay} markers={markers} />

      <View className="flex-row items-center justify-between mt-4 mb-2">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">
          {selectedDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {loading ? <ActivityIndicator size="small" color={themeColors.primary} /> : null}
      </View>

      {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}

      {!loading && dayEvents.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('termine.day-empty')}</Text>
      ) : (
        dayEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            color={colorFor(event.calendarId)}
            rsvp={rsvpPropsFor(event.id)}
            onPress={() => setSheetTarget({ eventId: event.id })}
          />
        ))
      )}

      <EventSheet
        target={sheetTarget}
        event={sheetEvent}
        onClose={() => setSheetTarget(null)}
        calendars={calendars}
        colorFor={colorFor}
        canWrite={canWrite}
        rsvp={sheetEvent ? rsvpPropsFor(sheetEvent.id) : null}
        onSave={handleSave}
        onDelete={deleteEvent}
      />

      {canWrite ? (
        <CalendarManageSheet
          visible={manageOpen}
          onClose={() => setManageOpen(false)}
          clubId={clubId}
          calendars={calendars}
          departments={info?.departments ?? []}
          colorFor={colorFor}
          onChanged={handleCalendarsChanged}
        />
      ) : null}
    </>
  );
}
