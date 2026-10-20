import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import type { Calendar } from '@/hooks/useCalendars';
import { defaultCalendarId } from './calendars';
import { useCancelPreview, type CalendarEvent, type EventInput } from '@/hooks/useEvents';
import { CANCEL_REASON_MAX, cancelPreviewKind, type CancelPreview } from '@/lib/notifyOptions';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import DateTimeField from '@/components/ui/DateTimeField';
import NotifySwitch from '@/components/ui/NotifySwitch';

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

export function ColorChip({
  label,
  color,
  active,
  onPress,
  disabled,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
        active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      } ${disabled ? 'opacity-50' : ''}`}
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

/** Audience preview (numbers only) shown before an event is cancelled. */
export function CancelPreviewCard({
  preview,
  loading,
  failed,
  onRetry,
}: {
  preview: CancelPreview | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  let body: React.ReactNode;
  if (loading) {
    body = <ActivityIndicator color={themeColors.primary} />;
  } else if (!preview) {
    body = failed ? (
      <View>
        <Text className="text-destructive text-sm mb-1">{t('termine.cancel.preview.error')}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onRetry} className="min-h-[44px] justify-center self-start">
          <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
        </TouchableOpacity>
      </View>
    ) : null;
  } else {
    const kind = cancelPreviewKind(preview);
    const a = preview.audience;
    body =
      kind === 'already-cancelled' ? (
        <Text className="text-foreground dark:text-foreground-dark text-sm">{t('termine.cancel.preview.already')}</Text>
      ) : kind === 'too-large' ? (
        <Text className="text-destructive text-sm">{t('termine.cancel.preview.too-large', { count: a.total })}</Text>
      ) : kind === 'nobody' ? (
        <Text className="text-foreground dark:text-foreground-dark text-sm">{t('termine.cancel.preview.nobody')}</Text>
      ) : (
        <View style={{ gap: 2 }}>
          <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
            {t('termine.cancel.preview.total', { count: a.total })}
          </Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {t('termine.cancel.preview.rsvp', { confirmed: preview.confirmed, waitlisted: preview.waitlisted })}
          </Text>
          {preview.departmentCalendar ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('termine.cancel.preview.department')}</Text>
          ) : null}
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {t('termine.cancel.preview.channels', { inApp: a.inApp, email: a.email, emailOnly: a.emailOnly })}
          </Text>
          {a.unreachable > 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
              {t('termine.cancel.preview.unreachable', { count: a.unreachable })}
            </Text>
          ) : null}
        </View>
      );
  }

  return (
    <View className="border border-border dark:border-border-dark rounded-xl p-3 mb-3" accessibilityLiveRegion="polite">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">{t('termine.cancel.preview.title')}</Text>
      {body}
    </View>
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
  clubId: string | null;
  rsvp: RsvpProps | null;
  /** `notify` is false only when the author switched "Mitglieder benachrichtigen" off (edit of an existing event). */
  onSave: (input: EventInput, id?: string, notify?: boolean) => Promise<void>;
  onDelete: (id: string, notify: boolean) => Promise<void>;
  onCancelEvent: (id: string, reason: string, notify: boolean) => Promise<void>;
}

function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Event detail (with RSVP, edit, delete) and create/edit form in one sheet, so no modal-to-modal swap. */
export default function EventSheet({ target, event, onClose, calendars, colorFor, canWrite, clubId, rsvp, onSave, onDelete, onCancelEvent }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();

  const [editing, setEditing] = useState(false);
  // Cancel / delete confirmation replaces the detail inside the same sheet (no modal-to-modal swap).
  const [action, setAction] = useState<'cancel' | 'delete' | null>(null);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState('');
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
    setAction(null);
    setNotify(true);
    setReason('');
    if ('day' in target) {
      setEditing(true);
      setCalendarId(defaultCalendarId(calendars));
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
    if (!calendarId || !title.trim() || !startsAt) return t('termine.form.required');
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) return t('termine.form.end-before-start');
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
          endsAt: endsAt ? endsAt.toISOString() : null,
          category: category.trim() || null,
          capacity: capacityNum,
        },
        isCreate ? undefined : event?.id,
        isCreate ? true : notify,
      );
      if (isCreate) onClose();
      else setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const { preview, loading: previewLoading, error: previewError, refetch: refetchPreview } = useCancelPreview(
    clubId,
    action === 'cancel' && event ? event.id : null,
  );
  const previewBlocksCancel = action === 'cancel' && (!preview || preview.alreadyCancelled);

  const openAction = (next: 'cancel' | 'delete') => {
    setError(null);
    setNotify(true);
    setReason('');
    setAction(next);
  };

  const handleConfirmAction = async () => {
    if (!event || !action) return;
    setSaving(true);
    setError(null);
    try {
      if (action === 'cancel') await onCancelEvent(event.id, reason, notify);
      else await onDelete(event.id, notify);
      // Cancelled events stay in the agenda, so keep the sheet on the (now cancelled) event.
      if (action === 'delete') onClose();
      else setAction(null);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
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
      {event?.cancelled ? (
        <Text className="text-destructive text-sm font-bold">
          {event.cancelReason ? `${t('termine.cancelled')} - ${t('termine.cancelled-reason', { reason: event.cancelReason })}` : t('termine.cancelled')}
        </Text>
      ) : rsvp ? (
        <RsvpControl {...rsvp} />
      ) : null}
    </View>
  ) : null;

  // One FormSheet for all modes so switching detail <-> edit <-> confirm doesn't remount the Modal.
  const sheetProps = action
    ? {
        title: action === 'cancel' ? t('termine.cancel.title') : t('termine.delete.title'),
        onClose: () => setAction(null),
        onSubmit: () => void handleConfirmAction(),
        submitLabel: action === 'cancel' ? t('termine.cancel.confirm') : t('ui.delete'),
        cancelLabel: t('ui.cancel'),
        submitDisabled: previewBlocksCancel,
        onDelete: undefined,
      }
    : editing
      ? {
          title: isCreate ? t('termine.form.create-title') : t('termine.form.edit-title'),
          onClose: isCreate ? onClose : () => setEditing(false),
          onSubmit: () => void handleSave(),
          submitLabel: undefined,
          cancelLabel: undefined,
          submitDisabled: false,
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
                  setNotify(true);
                  setEditing(true);
                }
              : undefined,
          submitLabel: t('termine.edit'),
          cancelLabel: t('ui.done'),
          submitDisabled: false,
          onDelete: canWrite ? () => openAction('delete') : undefined,
        };

  const confirmForm =
    action && event ? (
      <View>
        {action === 'delete' ? (
          <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">{t('termine.delete.message', { title: event.title })}</Text>
        ) : (
          <>
            <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">{t('termine.cancel.message', { title: event.title })}</Text>
            <Field label={t('termine.cancel.reason')}>
              <TextInput
                className={inputClassName}
                value={reason}
                onChangeText={setReason}
                maxLength={CANCEL_REASON_MAX}
                multiline
                style={{ minHeight: 72, textAlignVertical: 'top' }}
                placeholder={t('termine.cancel.reason-placeholder')}
                placeholderTextColor={themeColors.mutedForeground}
              />
            </Field>
            <CancelPreviewCard preview={preview} loading={previewLoading} failed={!!previewError} onRetry={() => void refetchPreview()} />
          </>
        )}
        <NotifySwitch
          label={t('termine.notify')}
          hint={action === 'cancel' ? t('termine.notify.hint-cancel') : t('termine.notify.hint-delete')}
          value={notify}
          onChange={setNotify}
          disabled={saving}
        />
      </View>
    ) : null;

  return (
    <FormSheet visible={visible} saving={saving} error={error} {...sheetProps}>
      {action ? (
        confirmForm
      ) : !editing ? (
        <>
          {detail}
          {canWrite && event && !event.cancelled ? (
            <TouchableOpacity
              onPress={() => openAction('cancel')}
              className="self-start justify-center mt-3"
              style={{ minHeight: 44 }}
              accessibilityRole="button"
            >
              <Text className="text-destructive text-sm font-semibold">{t('termine.cancel.open')}</Text>
            </TouchableOpacity>
          ) : null}
        </>
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
            <DateTimeField value={endsAt} onChange={setEndsAt} clearable />
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
          {!isCreate ? (
            <NotifySwitch label={t('termine.notify')} hint={t('termine.notify.hint-edit')} value={notify} onChange={setNotify} disabled={saving} />
          ) : null}
        </>
      )}
    </FormSheet>
  );
}
