import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { CalendarPlus, ClipboardCheck, Plus, Repeat, Settings2, Timer } from 'lucide-react-native';

import OfflineNotice from '@/components/ui/OfflineNotice';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useClubInfo } from '@/hooks/useClubInfo';
import { useCalendars } from '@/hooks/useCalendars';
import { normalizeEvent, useEvents, useEventMutations, useEventRsvp, useEventSeries, type CalendarEvent, type EventInput } from '@/hooks/useEvents';
import { useClubSettings } from '@/hooks/useClubSettings';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { getDepartmentColor } from '@/theme/departmentColors';
import { isSheetEventMissing, resolveSheetEvent } from '@/lib/eventFocus';
import { eventDayKeys } from '@/lib/eventDays';
import { apiFetch } from '@/lib/api';
import MonthCalendar, { toDayKey } from '@/components/ui/MonthCalendar';
import EventSheet, { formatTimeRange, ParticipationLine, RsvpControl, type EventSheetTarget, type RsvpProps, type RsvpState } from './EventSheet';
import CalendarManageSheet from './CalendarManageSheet';
import CalendarFeedsSheet from './CalendarFeedsSheet';
import EventActions, { type EventSubSheetKind } from './EventActions';
import AttendanceSheet from './AttendanceSheet';
import HelpersSheet from './HelpersSheet';
import RidesSheet from './RidesSheet';
import TimeSheet from './TimeSheet';
import { canOnEvent, canTrackTime } from '@/lib/eventRights';
import EventParticipation from './EventParticipation';
import { ApiError } from '@/lib/api';

interface Props {
  clubId: string;
  /** Set by a tapped push: select the event's day and open its sheet, then `onFocusHandled`. */
  focus?: EventFocus | null;
  onFocusHandled?: () => void;
  /** The sheet pointed at an event that does not exist (any more); the sheet was closed. */
  onEventGone?: () => void;
}

function EventRow({ event, color, rsvp, onPress, onAttendance }: { event: CalendarEvent; color: string; rsvp: RsvpProps; onPress: () => void; onAttendance?: () => void }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();

  return (
    <TouchableOpacity accessibilityRole="button"
      onPress={onPress}
      className="flex-row bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl mb-3 overflow-hidden"
    >
      <View style={{ width: 4, backgroundColor: color }} />
      <View className="flex-1 p-3">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text
            className="text-foreground dark:text-foreground-dark font-bold text-sm flex-shrink"
            style={event.cancelled ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
          >
            {event.title}
          </Text>
          {event.seriesId ? <Repeat size={12} color={themeColors.mutedForeground} accessibilityLabel={t('series.badge')} /> : null}
        </View>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{formatTimeRange(event, language, t('termine.all-day'))}</Text>
        <ParticipationLine event={event} />

        {event.cancelled ? (
          <View className="mt-2 self-start bg-destructive px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-white">{t('termine.cancelled')}</Text>
          </View>
        ) : null}
        {event.cancelled && event.cancelReason ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t('termine.cancelled-reason', { reason: event.cancelReason })}</Text>
        ) : null}

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

        {event.cancelled ? null : (
          <View className="mt-3 flex-row items-center flex-wrap" style={{ gap: 12 }}>
            <RsvpControl {...rsvp} />
            {onAttendance ? (
              <TouchableOpacity
                onPress={onAttendance}
                accessibilityRole="button"
                className="flex-row items-center justify-center border border-border dark:border-border-dark rounded-lg px-3"
                style={{ minHeight: 44, gap: 6 }}
              >
                <ClipboardCheck size={14} color={themeColors.foreground} />
                <Text className="text-foreground dark:text-foreground-dark text-xs font-semibold">{t('att.open')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
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

/** A tapped push (M3): jump to the event's day and open it. */
export interface EventFocus {
  event: CalendarEvent;
}

export default function TermineTab({ clubId, focus, onFocusHandled, onEventGone }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { info } = useClubInfo(clubId);
  const { calendars, refetch: refetchCalendars } = useCalendars(clubId);
  const { can, membership } = useOwnMembership(clubId);
  const canWrite = can('calendars:write');

  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => toDayKey(new Date()));
  const range = useMemo(() => monthRange(month), [month]);
  const { events, loading, loadError, staleAt, refetch } = useEvents(clubId, range);
  const { rsvp, cancelRsvp } = useEventRsvp(clubId, refetch);
  const { createEvent, updateEvent, deleteEvent, cancelEvent } = useEventMutations(clubId, refetch);
  const seriesActions = useEventSeries(clubId, refetch);
  const { settings: clubSettings } = useClubSettings(clubId);

  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [sheetTarget, setSheetTarget] = useState<EventSheetTarget | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [feedsOpen, setFeedsOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const trackTime = canTrackTime(membership);
  // The event fetched for a tapped push: shown even when it is not in the loaded month list.
  const [fetchedEvent, setFetchedEvent] = useState<CalendarEvent | null>(null);
  // Attendance / helper sheets replace the event sheet (no modal-to-modal stacking) and bring it back when closed.
  const [sub, setSub] = useState<{ kind: EventSubSheetKind; event: CalendarEvent } | null>(null);

  useEffect(() => {
    if (!focus) return;
    const start = new Date(focus.event.startsAt);
    if (!Number.isNaN(start.getTime())) {
      setMonth(start);
      setSelectedDay(toDayKey(start));
      setFetchedEvent(focus.event);
      setSheetTarget({ eventId: focus.event.id });
    }
    onFocusHandled?.();
  }, [focus, onFocusHandled]);

  const fetchedEventOrListed = (eventId: string) => events.some((e) => e.id === eventId) || fetchedEvent?.id === eventId;

  const runRsvp = async (eventId: string, action: () => Promise<unknown>) => {
    setPendingIds((prev) => ({ ...prev, [eventId]: true }));
    setError(null);
    try {
      await action();
      // `myRsvp` and the counts come from the backend: the list refetches (see useEventRsvp), a pushed event outside the month is re-read here.
      if (fetchedEvent?.id === eventId) {
        const { data } = await apiFetch<{ data: CalendarEvent }>(`/events/${encodeURIComponent(eventId)}?clubId=${encodeURIComponent(clubId)}`);
        setFetchedEvent(data ? normalizeEvent(data) : data);
      }
    } catch (err) {
      // The event wants a form or a group size: the quick sign-up of the list cannot answer that, the sheet can.
      if (err instanceof ApiError && err.status === 422 && fetchedEventOrListed(eventId)) {
        setSheetTarget({ eventId });
        setError(null);
      } else {
        setError(apiErrorMessage(err, t));
      }
    } finally {
      setPendingIds((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const myRsvpOf = (eventId: string): RsvpState => {
    const event = events.find((e) => e.id === eventId) ?? (fetchedEvent?.id === eventId ? fetchedEvent : null);
    return event?.myRsvp ?? null;
  };

  const rsvpPropsFor = (eventId: string): RsvpProps => ({
    state: myRsvpOf(eventId),
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

  // Multi-day events are marked and listed on every day they cover.
  const { markers, byDay } = useMemo(() => {
    const dots: Record<string, string[]> = {};
    const days = new Map<string, CalendarEvent[]>();
    const list = Array.isArray(events) ? events.filter((e) => e && typeof e.startsAt === 'string') : [];
    for (const event of list.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
      const color = colorFor(event.calendarId);
      for (const key of eventDayKeys(event)) {
        dots[key] = dots[key]?.includes(color) ? dots[key] : [...(dots[key] ?? []), color];
        days.set(key, [...(days.get(key) ?? []), event]);
      }
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

  const handleSave = async (input: EventInput, id?: string, notify = true) => {
    if (id) await updateEvent(id, input, notify);
    else await createEvent(input);
  };

  const handleCalendarsChanged = useCallback(() => {
    void refetchCalendars();
    void refetch();
  }, [refetchCalendars, refetch]);

  const canAttendOn = (event: CalendarEvent) => {
    const dept = calendars.find((c) => c.id === event.calendarId)?.departmentId ?? null;
    return canOnEvent('attendance:read', membership, dept) || canOnEvent('attendance:write', membership, dept);
  };

  const openSub = (kind: EventSubSheetKind, event: CalendarEvent) => {
    if (!events.some((e) => e.id === event.id)) setFetchedEvent(event);
    setSub({ kind, event });
    setSheetTarget(null);
  };
  const closeSub = () => {
    if (sub) setSheetTarget({ eventId: sub.event.id });
    setSub(null);
  };

  const sheetEventId = sheetTarget && 'eventId' in sheetTarget ? sheetTarget.eventId : null;
  const sheetEvent = sheetEventId ? resolveSheetEvent(events, sheetEventId, fetchedEvent) : null;

  // An open detail sheet whose event vanished (deleted meanwhile, not visible) is closed with a notice
  // instead of hanging on an empty sheet.
  useEffect(() => {
    if (!isSheetEventMissing({ eventId: sheetEventId, loading, resolved: sheetEvent })) return;
    setSheetTarget(null);
    onEventGone?.();
  }, [sheetEventId, loading, sheetEvent, onEventGone]);

  return (
    <>
      {staleAt ? <OfflineNotice savedAt={staleAt} /> : null}
      {canWrite ? (
        <View className="flex-row mb-3" style={{ gap: 8 }}>
          <TouchableOpacity accessibilityRole="button"
            onPress={() => setManageOpen(true)}
            className="flex-1 flex-row items-center justify-center border border-border dark:border-border-dark rounded-xl py-2.5"
            style={{ gap: 6 }}
          >
            <Settings2 size={16} color={themeColors.foreground} />
            <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('kalender.manage.open')}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            onPress={() => setSheetTarget({ day: selectedDate })}
            className="flex-1 flex-row items-center justify-center bg-primary dark:bg-primary-dark rounded-xl py-2.5"
            style={{ gap: 6 }}
          >
            <Plus size={16} color={themeColors.primaryForeground} />
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('termine.new')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => setFeedsOpen(true)}
        accessibilityRole="button"
        className="flex-row items-center justify-center border border-border dark:border-border-dark rounded-xl mb-3"
        style={{ gap: 6, minHeight: 44 }}
      >
        <CalendarPlus size={16} color={themeColors.foreground} />
        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('feeds.open')}</Text>
      </TouchableOpacity>

      {trackTime ? (
        <TouchableOpacity
          onPress={() => setTimeOpen(true)}
          accessibilityRole="button"
          className="flex-row items-center justify-center border border-border dark:border-border-dark rounded-xl mb-3"
          style={{ gap: 6, minHeight: 44 }}
        >
          <Timer size={16} color={themeColors.foreground} />
          <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('time.open')}</Text>
        </TouchableOpacity>
      ) : null}

      <MonthCalendar month={month} onMonthChange={handleMonthChange} selectedDay={selectedDay} onSelectDay={handleSelectDay} markers={markers} />

      <View className="flex-row items-center justify-between mt-4 mb-2">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">
          {selectedDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {loading ? <ActivityIndicator size="small" color={themeColors.primary} /> : null}
      </View>

      {error || loadError ? <Text className="text-destructive dark:text-destructive-dark text-sm mb-3">{error ?? apiErrorMessage(loadError, t)}</Text> : null}

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
            onAttendance={canAttendOn(event) ? () => openSub('attendance', event) : undefined}
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
        clubId={clubId}
        rsvp={sheetEvent ? rsvpPropsFor(sheetEvent.id) : null}
        onSave={handleSave}
        onDelete={deleteEvent}
        onCancelEvent={cancelEvent}
        seriesActions={seriesActions}
        clubState={clubSettings?.state ?? null}
        participation={
          sheetEvent ? (
            <EventParticipation clubId={clubId} event={sheetEvent} fallback={rsvpPropsFor(sheetEvent.id)} onChanged={refetch} />
          ) : null
        }
        detailExtras={
          sheetEvent ? (
            <EventActions
              clubId={clubId}
              event={sheetEvent}
              calendarDepartmentId={calendars.find((c) => c.id === sheetEvent.calendarId)?.departmentId ?? null}
              membership={membership}
              onOpen={(kind) => openSub(kind, sheetEvent)}
            />
          ) : null
        }
      />

      {trackTime ? <TimeSheet visible={timeOpen} onClose={() => setTimeOpen(false)} clubId={clubId} /> : null}
      {sub?.kind === 'time' ? <TimeSheet visible onClose={closeSub} clubId={clubId} eventId={sub.event.id} eventTitle={sub.event.title} /> : null}
      {sub?.kind === 'rides' ? <RidesSheet visible onClose={closeSub} clubId={clubId} event={sub.event} /> : null}
      {sub?.kind === 'helpers' ? <HelpersSheet visible onClose={closeSub} clubId={clubId} event={sub.event} /> : null}
      {sub?.kind === 'attendance' ? <AttendanceSheet visible onClose={closeSub} clubId={clubId} event={sub.event} /> : null}

      <CalendarFeedsSheet visible={feedsOpen} onClose={() => setFeedsOpen(false)} clubId={clubId} calendars={calendars} />

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
