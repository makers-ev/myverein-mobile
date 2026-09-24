import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import type { Calendar } from '@/hooks/useCalendars';
import type { CalendarEvent, EventInput } from '@/hooks/useEvents';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import DateTimeField from '@/components/ui/DateTimeField';

// Caller's own RSVP status isn't in the GET /events response -- tracked client-side after rsvp()/cancelRsvp().
export type RsvpState = 'angemeldet' | 'warteliste' | null;

export interface RsvpProps {
  state: RsvpState;
  pending: boolean;
  onRsvp: () => void;
  onCancel: () => void;
}

/** Opens the sheet on an existing event (detail view) or on a day (create form). */
export type EventSheetTarget = { eventId: string } | { day: Date };

export function formatTimeRange(event: CalendarEvent, language: string): string {
  const opts = { hour: '2-digit', minute: '2-digit' } as const;
  const start = new Date(event.startsAt).toLocaleTimeString(language, opts);
  return event.endsAt ? `${start} – ${new Date(event.endsAt).toLocaleTimeString(language, opts)}` : start;
}

export function RsvpControl({ state, pending, onRsvp, onCancel }: RsvpProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  if (state) {
    return (
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Text className="text-success dark:text-success-dark text-xs font-semibold">
          {state === 'angemeldet' ? t('termine.rsvp.confirmed') : t('termine.rsvp.waitlist')}
        </Text>
        <TouchableOpacity onPress={onCancel} disabled={pending}>
          <Text className="text-destructive text-xs font-semibold">{t('termine.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity
      className={`bg-primary dark:bg-primary-dark rounded-lg py-2 px-4 items-center self-start ${pending ? 'opacity-70' : ''}`}
      onPress={onRsvp}
      disabled={pending}
    >
      {pending ? (
        <ActivityIndicator color={themeColors.primaryForeground} size="small" />
      ) : (
        <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">{t('termine.rsvp')}</Text>
      )}
    </TouchableOpacity>
  );
}

export function ColorChip({ label, color, active, onPress }: { label: string; color?: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
        active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      }`}
      style={{ gap: 6 }}
    >
      {color ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
      ) : null}
      <Text
        className={`text-sm ${active ? 'text-primary-foreground dark:text-primary-foreground-dark font-bold' : 'text-foreground dark:text-foreground-dark'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface Props {
  target: EventSheetTarget | null;
  /** Fresh event resolved from the list for an `eventId` target. */
  event: CalendarEvent | null;
  onClose: () => void;
  calendars: Calendar[];
  colorFor: (calendarId: string) => string;
  canWrite: boolean;
  rsvp: RsvpProps | null;
  onSave: (input: EventInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Event detail (with RSVP, edit, delete) and create/edit form in one sheet, so no modal-to-modal swap. */
export default function EventSheet({ target, event, onClose, calendars, colorFor, canWrite, rsvp, onSave, onDelete }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();

  const [editing, setEditing] = useState(false);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [capacity, setCapacity] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillFromEvent = (e: CalendarEvent) => {
    setCalendarId(e.calendarId);
    setTitle(e.title);
    setDescription(e.description ?? '');
    setCategory(e.category ?? '');
    setCapacity(e.capacity != null ? String(e.capacity) : '');
    setStartsAt(new Date(e.startsAt));
    setEndsAt(e.endsAt ? new Date(e.endsAt) : null);
  };

  // Reset only when a new target opens, not on every list refetch.
  useEffect(() => {
    if (!target) return;
    setError(null);
    setSaving(false);
    if ('day' in target) {
      setEditing(true);
      setCalendarId((calendars.find((c) => c.isDefault) ?? calendars[0])?.id ?? null);
      setTitle('');
      setDescription('');
      setCategory('');
      setCapacity('');
      setStartsAt(atHour(target.day, 18));
      setEndsAt(atHour(target.day, 20));
    } else {
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const isCreate = !!target && 'day' in target;
  const trimmedCapacity = capacity.trim();
  const capacityNum = trimmedCapacity ? Number(trimmedCapacity) : null;

  const validate = (): string | null => {
    if (!calendarId || !title.trim() || !startsAt || !endsAt) return t('termine.form.required');
    if (endsAt.getTime() <= startsAt.getTime()) return t('termine.form.end-before-start');
    if (capacityNum !== null && (!Number.isInteger(capacityNum) || capacityNum <= 0)) return t('termine.form.capacity-invalid');
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          calendarId: calendarId!,
          title: title.trim(),
          description: description.trim() || null,
          startsAt: startsAt!.toISOString(),
          endsAt: endsAt!.toISOString(),
          category: category.trim() || null,
          capacity: capacityNum,
        },
        isCreate ? undefined : event?.id,
      );
      if (isCreate) onClose();
      else setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!event) return;
    Alert.alert(t('termine.delete.title'), t('termine.delete.message', { title: event.title }), [
      { text: t('ui.cancel'), style: 'cancel' },
      {
        text: t('ui.delete'),
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await onDelete(event.id);
            onClose();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const visible = !!target && (isCreate || !!event);
  const calendar = event ? calendars.find((c) => c.id === event.calendarId) : undefined;

  const detail = event ? (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colorFor(event.calendarId),
          }}
        />
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{calendar?.name ?? '—'}</Text>
      </View>
      <View>
        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
          {new Date(event.startsAt).toLocaleDateString(language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{formatTimeRange(event, language)}</Text>
      </View>
      {event.description ? <Text className="text-foreground dark:text-foreground-dark text-sm">{event.description}</Text> : null}
      {event.category || event.capacity != null ? (
        <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
          {event.category ? (
            <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{event.category}</Text>
            </View>
          ) : null}
          {event.capacity != null ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
              {t('termine.capacity', { capacity: event.capacity })}
            </Text>
          ) : null}
        </View>
      ) : null}
      {rsvp ? <RsvpControl {...rsvp} /> : null}
    </View>
  ) : null;

  // One FormSheet for both modes so switching detail <-> edit doesn't remount the Modal.
  const sheetProps = editing
    ? {
        title: isCreate ? t('termine.form.create-title') : t('termine.form.edit-title'),
        onClose: isCreate ? onClose : () => setEditing(false),
        onSubmit: () => void handleSave(),
        submitLabel: undefined,
        cancelLabel: undefined,
        onDelete: undefined,
      }
    : {
        title: event?.title ?? '',
        onClose,
        onSubmit:
          canWrite && event
            ? () => {
                fillFromEvent(event);
                setError(null);
                setEditing(true);
              }
            : undefined,
        submitLabel: t('termine.edit'),
        cancelLabel: t('ui.done'),
        onDelete: canWrite ? confirmDelete : undefined,
      };

  return (
    <FormSheet visible={visible} saving={saving} error={error} {...sheetProps}>
      {!editing ? (
        detail
      ) : (
        <>
          <Field label={t('termine.form.calendar')}>
            {calendars.length === 0 ? (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('termine.form.no-calendars')}</Text>
            ) : (
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {calendars.map((c) => (
                  <ColorChip
                    key={c.id}
                    label={c.name}
                    color={colorFor(c.id)}
                    active={c.id === calendarId}
                    onPress={() => setCalendarId(c.id)}
                  />
                ))}
              </View>
            )}
          </Field>
          <Field label={t('termine.form.title')}>
            <TextInput
              className={inputClassName}
              value={title}
              onChangeText={setTitle}
              maxLength={300}
              placeholderTextColor={themeColors.mutedForeground}
            />
          </Field>
          <Field label={t('termine.form.start')}>
            <DateTimeField
              value={startsAt}
              onChange={(value) => {
                // Keep the duration when the start moves.
                if (value && startsAt && endsAt) setEndsAt(new Date(value.getTime() + (endsAt.getTime() - startsAt.getTime())));
                setStartsAt(value);
              }}
            />
          </Field>
          <Field label={t('termine.form.end')}>
            <DateTimeField value={endsAt} onChange={setEndsAt} />
          </Field>
          <Field label={t('termine.form.description')}>
            <TextInput
              className={inputClassName}
              value={description}
              onChangeText={setDescription}
              multiline
              style={{ minHeight: 72, textAlignVertical: 'top' }}
              placeholderTextColor={themeColors.mutedForeground}
            />
          </Field>
          <View className="flex-row" style={{ gap: 10 }}>
            <View className="flex-1">
              <Field label={t('termine.form.category')}>
                <TextInput
                  className={inputClassName}
                  value={category}
                  onChangeText={setCategory}
                  maxLength={100}
                  placeholderTextColor={themeColors.mutedForeground}
                />
              </Field>
            </View>
            <View style={{ width: 110 }}>
              <Field label={t('termine.form.capacity')}>
                <TextInput
                  className={inputClassName}
                  value={capacity}
                  onChangeText={(v) => setCapacity(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="∞"
                  placeholderTextColor={themeColors.mutedForeground}
                />
              </Field>
            </View>
          </View>
        </>
      )}
    </FormSheet>
  );
}
