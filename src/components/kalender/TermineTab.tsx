import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ClipboardCheck, Repeat } from 'lucide-react-native';

import OfflineNotice from '@/components/ui/OfflineNotice';
import PressScale from '@/components/ui/PressScale';
import Badge from '@/components/ui/Badge';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
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
import MyHoursSheet from './MyHoursSheet';
import TeamHoursSheet from './TeamHoursSheet';
import { canOnEvent, canSeeTeamHours, canTrackTime } from '@/lib/eventRights';
import EventParticipation from './EventParticipation';
import { ApiError } from '@/lib/api';
import DocsLink from '@/components/ui/DocsLink';
import { DOCS_PATHS } from '@/lib/docsUrl';

interface Props {
  clubId: string;
  /** Set by a tapped push: select the event's day and open its sheet, then `onFocusHandled`. */
  focus?: EventFocus | null;
  onFocusHandled?: () => void;
  /** The sheet pointed at an event that does not exist (any more); the sheet was closed. */
  onEventGone?: () => void;
  /** An action chosen in the Kalender top bar (+ / overflow menu); `n` changes with every tap. */
  command?: { kind: KalenderCommand; n: number } | null;
}

/** Top-bar actions of the Kalender screen that open a sheet owned by this tab. */
export type KalenderCommand = 'new' | 'manage' | 'feeds' | 'time' | 'myHours' | 'teamHours';

function EventRow({ event, color, calendarName, rsvp, onPress, onAttendance }: { event: CalendarEvent; color: string; calendarName: string | null; rsvp: RsvpProps; onPress: () => void; onAttendance?: () => void }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const when = formatTimeRange(event, language, t('termine.all-day'));

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={[event.title, when, calendarName, event.cancelled ? t('termine.cancelled') : null].filter(Boolean).join(', ')}
      onPress={onPress}
      scale={0.99}
      className="flex-row bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] mb-2 overflow-hidden"
    >
      {/* Department colour as a 3pt bar; the calendar name next to the time explains it (no legend needed). */}
      <View style={{ width: 3, backgroundColor: event.cancelled ? themeColors.border : color }} />
      <View className="flex-1 px-4 py-3">
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium" style={{ fontVariant: ['tabular-nums'] }}>
          {calendarName ? `${when} · ${calendarName}` : when}
        </Text>
        <View className="flex-row items-center mt-0.5" style={{ gap: 6 }}>
          <Text className={`text-[17px] leading-[22px] font-semibold flex-shrink ${event.cancelled ? 'text-muted-foreground dark:text-muted-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}>
            {event.title}
          </Text>
          {event.seriesId ? <Repeat size={14} strokeWidth={1.75} color={themeColors.mutedForeground} accessibilityLabel={t('series.badge')} /> : null}
        </View>
        <ParticipationLine event={event} />

        {event.cancelled ? (
          <View className="mt-2">
            <Badge tone="danger">{t('termine.cancelled')}</Badge>
          </View>
        ) : null}
        {event.cancelled && event.cancelReason ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-1">{t('termine.cancelled-reason', { reason: event.cancelReason })}</Text>
        ) : null}

        {event.category || event.capacity != null ? (
          <View className="flex-row items-center flex-wrap mt-2" style={{ gap: 6 }}>
            {event.category ? <Badge>{event.category}</Badge> : null}
            {event.capacity != null ? (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px]">{t('termine.capacity', { capacity: event.capacity })}</Text>
            ) : null}
          </View>
        ) : null}

        {event.cancelled ? null : (
          <View className="mt-3 flex-row items-center flex-wrap" style={{ gap: 8 }}>
            <RsvpControl {...rsvp} />
            {onAttendance ? <Button variant="secondary" size="M" icon={ClipboardCheck} label={t('att.open')} onPress={onAttendance} /> : null}
          </View>
        )}
      </View>
    </PressScale>
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

export default function TermineTab({ clubId, focus, onFocusHandled, onEventGone, command }: Props) {
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
  const [myHoursOpen, setMyHoursOpen] = useState(false);
  const [teamHoursOpen, setTeamHoursOpen] = useState(false);
  const myHours = trackTime || membership?.hasRate === true;
  const teamHours = canSeeTeamHours(membership);
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

  // Top-bar actions (decision D3: the hours and calendar tools live in the header, not as buttons above the grid).
  const lastCommand = useRef(0);
  useEffect(() => {
    if (!command || command.n === lastCommand.current) return;
    lastCommand.current = command.n;
    switch (command.kind) {
      case 'new':
        if (canWrite) setSheetTarget({ day: selectedDate });
        break;
      case 'manage':
        if (canWrite) setManageOpen(true);
        break;
      case 'feeds':
        setFeedsOpen(true);
        break;
      case 'time':
        if (trackTime) setTimeOpen(true);
        break;
      case 'myHours':
        if (myHours) setMyHoursOpen(true);
        break;
      case 'teamHours':
        if (teamHours) setTeamHoursOpen(true);
        break;
    }
    // Only a new command (n) triggers; the rights and the selected day are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

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
    // One marker per event: the grid shows neutral dots ("something is on"), the colours live on the event rows.
    const dots: Record<string, string[]> = {};
    const days = new Map<string, CalendarEvent[]>();
    const list = Array.isArray(events) ? events.filter((e) => e && typeof e.startsAt === 'string') : [];
    for (const event of list.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
      for (const key of eventDayKeys(event)) {
        dots[key] = [...(dots[key] ?? []), event.id];
        days.set(key, [...(days.get(key) ?? []), event]);
      }
    }
    return { markers: dots, byDay: days };
  }, [events]);

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
      <MonthCalendar month={month} onMonthChange={handleMonthChange} selectedDay={selectedDay} onSelectDay={handleSelectDay} markers={markers} />

      <View className="flex-row items-center justify-between mt-5 mb-2" style={{ minHeight: 24 }}>
        <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold">
          {selectedDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {loading ? <ActivityIndicator size="small" color={themeColors.primaryText} /> : null}
      </View>

      {error || loadError ? (
        <View className="mb-3">
          <Banner tone="danger" body={error ?? apiErrorMessage(loadError, t)} />
        </View>
      ) : null}

      {!loading && dayEvents.length === 0 ? (
        <View className="py-2">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{t('termine.day-empty')}</Text>
          <DocsLink path={DOCS_PATHS.calendar} />
        </View>
      ) : (
        dayEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            color={colorFor(event.calendarId)}
            calendarName={calendars.find((c) => c.id === event.calendarId)?.name ?? null}
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
      {myHours ? <MyHoursSheet visible={myHoursOpen} onClose={() => setMyHoursOpen(false)} clubId={clubId} /> : null}
      {teamHours ? <TeamHoursSheet visible={teamHoursOpen} onClose={() => setTeamHoursOpen(false)} clubId={clubId} /> : null}
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
