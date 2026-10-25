import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CheckCheck, UserPlus } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useEventAttendance } from '@/hooks/useEventAttendance';
import {
  ATTENDANCE_REASON_MAX,
  ATTENDANCE_STATUSES,
  GUEST_NAME_MAX,
  supervisorCandidates,
  toggleStatus,
  toggleSupervisor,
  type AttendanceEntry,
  type AttendanceStatus,
} from '@/lib/attendance';
import { formatEventRange } from '@/lib/eventDays';
import type { CalendarEvent } from '@/hooks/useEvents';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  event: CalendarEvent;
}

const STATUS_STYLE: Record<AttendanceStatus, { selected: string; text: string }> = {
  anwesend: { selected: 'bg-success dark:bg-success-dark', text: 'text-white' },
  entschuldigt: { selected: 'bg-warning dark:bg-warning-dark', text: 'text-white dark:text-black' },
  unentschuldigt: { selected: 'bg-destructive', text: 'text-white' },
};

function StatusButtons({
  entry,
  disabled,
  onChange,
}: {
  entry: AttendanceEntry;
  disabled: boolean;
  onChange: (status: AttendanceStatus | null) => void;
}) {
  const { t } = useLanguage();
  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {ATTENDANCE_STATUSES.map((status) => {
        const selected = entry.status === status;
        const style = STATUS_STYLE[status];
        return (
          <TouchableOpacity
            key={status}
            onPress={() => onChange(toggleStatus(entry.status, status))}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${entry.displayName}: ${t(`att.status.${status}`)}`}
            accessibilityState={{ selected, disabled }}
            className={`flex-1 rounded-xl items-center justify-center border ${
              selected ? `${style.selected} border-transparent` : 'border-border dark:border-border-dark bg-card dark:bg-card-dark'
            } ${disabled ? 'opacity-60' : ''}`}
            style={{ minHeight: 48 }}
          >
            <Text className={`text-xs font-bold ${selected ? style.text : 'text-foreground dark:text-foreground-dark'}`}>{t(`att.status.${status}`)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'warning' }) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${tone === 'warning' ? 'bg-warning/15 dark:bg-warning-dark/20' : 'bg-muted dark:bg-muted-dark'}`}>
      <Text
        className={`text-xs font-semibold ${
          tone === 'warning' ? 'text-warning dark:text-warning-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function EntryRow({ entry, disabled, onChange }: { entry: AttendanceEntry; disabled: boolean; onChange: (status: AttendanceStatus | null) => void }) {
  const { t } = useLanguage();
  return (
    <View className="border border-border dark:border-border-dark rounded-xl p-3 mb-2">
      <View className="flex-row items-center flex-wrap mb-2" style={{ gap: 6 }}>
        <Text className="text-foreground dark:text-foreground-dark text-base font-semibold flex-shrink" accessibilityRole="header">
          {entry.displayName}
        </Text>
        {entry.guestName ? <Badge label={t('att.badge.guest')} /> : null}
        {entry.isMinor ? <Badge label={t('att.badge.minor')} /> : null}
        {entry.prefilled ? <Badge label={t('att.badge.absence')} tone="warning" /> : null}
        {!entry.onRoster && entry.rsvp === 'angemeldet' ? <Badge label={t('att.badge.rsvp')} /> : null}
      </View>
      <StatusButtons entry={entry} disabled={disabled} onChange={onChange} />
    </View>
  );
}

/**
 * Attendance list at the pitch (Wave 12 M4): big tap targets, "Alle anwesend", guest by name, supervision, close with a
 * correction reason afterwards. Every tap is saved on its own (batched, re-sent after a short network break, see
 * `useEventAttendance`); leaving with unsent taps asks first. The reason of an absence report is never shown.
 */
export default function AttendanceSheet({ visible, onClose, clubId, event }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const att = useEventAttendance(clubId, visible ? event.id : null);
  const { view } = att;
  const [guest, setGuest] = useState('');
  const [reason, setReason] = useState('');
  const [pickingSupervisors, setPickingSupervisors] = useState(false);
  const [supervisorDraft, setSupervisorDraft] = useState<string[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);

  useEffect(() => {
    if (visible) return;
    setGuest('');
    setReason('');
    setPickingSupervisors(false);
    setConfirmClose(false);
    setMarkOpen(false);
    setShowCorrections(false);
  }, [visible]);

  const canEdit = !!view?.canWrite;
  const needsReason = !!view?.closed;
  const lockedByReason = needsReason && !reason.trim();
  const disabled = !canEdit || lockedByReason;

  const requestClose = () => {
    if (att.unsent === 0) {
      onClose();
      return;
    }
    Alert.alert(t('att.unsent.title'), t('att.unsent.message', { count: att.unsent }), [
      { text: t('att.unsent.stay'), style: 'cancel' },
      { text: t('att.unsent.discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  const changeReason = (value: string) => {
    setReason(value);
    att.setReason(value);
  };

  const addGuest = async () => {
    const ok = await att.addGuest(guest);
    if (ok) setGuest('');
  };

  const startSupervisors = () => {
    setSupervisorDraft(view?.supervisors.map((s) => s.clubMemberId) ?? []);
    setPickingSupervisors(true);
  };
  const saveSupervisors = async () => {
    const ok = await att.saveSupervisors(supervisorDraft);
    if (ok) setPickingSupervisors(false);
  };
  const close = async () => {
    const ok = await att.closeList(markOpen);
    if (ok) setConfirmClose(false);
  };

  const errorText = att.blocked ? t('att.sync.blocked') : att.actionError ? apiErrorMessage(att.actionError, t) : null;

  return (
    <FormSheet visible={visible} title={t('att.title', { title: event.title })} onClose={requestClose} cancelLabel={t('ui.done')} error={errorText}>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">
        {new Date(event.startsAt).toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })} · {formatEventRange(event, language, t('termine.all-day'))}
      </Text>

      {att.loading && !view ? (
        <View className="py-8 items-center" accessibilityLabel={t('att.loading')}>
          <ActivityIndicator color={themeColors.primary} />
        </View>
      ) : att.loadError && !view ? (
        <View className="py-4">
          <Text className="text-destructive text-sm mb-2">{apiErrorMessage(att.loadError, t)}</Text>
          <TouchableOpacity onPress={() => void att.reload()} accessibilityRole="button" className="self-start justify-center" style={{ minHeight: 44 }}>
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : view ? (
        <View>
          <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }} accessibilityLiveRegion="polite">
            <Badge label={t('att.summary.present', { count: view.summary.anwesend })} />
            <Badge label={t('att.summary.excused', { count: view.summary.entschuldigt })} />
            <Badge label={t('att.summary.absent', { count: view.summary.unentschuldigt })} />
            <Badge label={t('att.summary.open', { count: view.summary.offen })} tone={view.summary.offen > 0 ? 'warning' : 'muted'} />
          </View>

          {att.problem === 'network' ? (
            <View className="border border-warning dark:border-warning-dark rounded-xl p-3 mb-3" accessibilityLiveRegion="polite">
              <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('att.sync.network', { count: att.unsent })}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{t('att.sync.network-hint')}</Text>
              <TouchableOpacity onPress={att.retryNow} accessibilityRole="button" className="self-start justify-center" style={{ minHeight: 44 }}>
                <Text className="text-primary dark:text-primary-dark font-semibold">{t('att.sync.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {att.problem === 'rejected' ? <Text className="text-destructive text-sm mb-3">{t('att.sync.rejected')}</Text> : null}
          {att.problem === 'reason_required' ? <Text className="text-destructive text-sm mb-3">{t('att.sync.reason-required')}</Text> : null}

          {!canEdit ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('att.read-only')}</Text>
          ) : view.closed ? (
            <View className="mb-3">
              <Text className="text-foreground dark:text-foreground-dark text-sm mb-2">{t('att.closed')}</Text>
              <Field label={t('att.reason.label')}>
                <TextInput
                  className={inputClassName}
                  value={reason}
                  onChangeText={changeReason}
                  maxLength={ATTENDANCE_REASON_MAX}
                  placeholder={t('att.reason.placeholder')}
                  placeholderTextColor={themeColors.mutedForeground}
                  accessibilityLabel={t('att.reason.label')}
                />
              </Field>
            </View>
          ) : (
            <TouchableOpacity
              onPress={att.markAllPresent}
              disabled={view.summary.offen === 0}
              accessibilityRole="button"
              className={`flex-row items-center justify-center bg-primary dark:bg-primary-dark rounded-xl mb-3 ${view.summary.offen === 0 ? 'opacity-50' : ''}`}
              style={{ gap: 8, minHeight: 52 }}
            >
              <CheckCheck size={18} color={themeColors.primaryForeground} />
              <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('att.all-present')}</Text>
            </TouchableOpacity>
          )}

          {view.supervisionWarning ? (
            <View className="border border-warning dark:border-warning-dark rounded-xl p-3 mb-3" accessibilityLiveRegion="polite">
              <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('att.supervision.warning', { count: view.minorsPresent })}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{t('att.supervision.disclaimer')}</Text>
            </View>
          ) : null}

          {view.entries.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('att.empty')}</Text>
          ) : (
            view.entries.map((entry) => (
              <EntryRow key={entry.key} entry={entry} disabled={disabled || att.busy} onChange={(status) => att.setStatus(entry.key, status)} />
            ))
          )}

          {canEdit ? (
            <View className="mt-2 mb-4">
              <Field label={t('att.guest.label')}>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <TextInput
                    className={`${inputClassName} flex-1`}
                    value={guest}
                    onChangeText={setGuest}
                    maxLength={GUEST_NAME_MAX}
                    editable={!disabled && !att.busy}
                    placeholder={t('att.guest.placeholder')}
                    placeholderTextColor={themeColors.mutedForeground}
                    accessibilityLabel={t('att.guest.label')}
                    returnKeyType="done"
                    onSubmitEditing={() => void addGuest()}
                  />
                  <TouchableOpacity
                    onPress={() => void addGuest()}
                    disabled={disabled || att.busy || !guest.trim()}
                    accessibilityRole="button"
                    accessibilityLabel={t('att.guest.add')}
                    className={`bg-primary dark:bg-primary-dark rounded-xl items-center justify-center ${disabled || att.busy || !guest.trim() ? 'opacity-50' : ''}`}
                    style={{ minHeight: 44, minWidth: 48 }}
                  >
                    <UserPlus size={18} color={themeColors.primaryForeground} />
                  </TouchableOpacity>
                </View>
              </Field>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('att.guest.hint')}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="text-foreground dark:text-foreground-dark text-sm font-bold mb-1">{t('att.supervisors.title')}</Text>
            {pickingSupervisors ? (
              <View>
                {supervisorCandidates(view).length === 0 ? (
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('att.supervisors.none-available')}</Text>
                ) : (
                  supervisorCandidates(view).map((c) => {
                    const on = supervisorDraft.includes(c.clubMemberId);
                    return (
                      <TouchableOpacity
                        key={c.clubMemberId}
                        onPress={() => setSupervisorDraft((d) => toggleSupervisor(d, c.clubMemberId))}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={c.displayName}
                        className="flex-row items-center"
                        style={{ minHeight: 44, gap: 10 }}
                      >
                        <View
                          className={`w-6 h-6 rounded-md border-2 ${on ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'}`}
                        />
                        <Text className="text-foreground dark:text-foreground-dark text-base">{c.displayName}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
                <View className="flex-row" style={{ gap: 12 }}>
                  <TouchableOpacity onPress={() => void saveSupervisors()} disabled={att.busy} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
                    <Text className="text-primary dark:text-primary-dark font-semibold">{t('ui.save')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPickingSupervisors(false)} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark font-semibold">{t('ui.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
                  {view.supervisors.length > 0 ? view.supervisors.map((s) => s.displayName).join(', ') : t('att.supervisors.empty')}
                </Text>
                {canEdit && !lockedByReason ? (
                  <TouchableOpacity onPress={startSupervisors} accessibilityRole="button" className="self-start justify-center" style={{ minHeight: 44 }}>
                    <Text className="text-primary dark:text-primary-dark font-semibold">{t('att.supervisors.edit')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {canEdit && !view.closed ? (
            confirmClose ? (
              <View className="border border-border dark:border-border-dark rounded-xl p-3 mb-3">
                <Text className="text-foreground dark:text-foreground-dark text-sm mb-2">{t('att.close.message')}</Text>
                {view.summary.offen > 0 ? (
                  <TouchableOpacity
                    onPress={() => setMarkOpen((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: markOpen }}
                    className="flex-row items-center"
                    style={{ minHeight: 44, gap: 10 }}
                  >
                    <View
                      className={`w-6 h-6 rounded-md border-2 ${markOpen ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'}`}
                    />
                    <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm">{t('att.close.mark-open', { count: view.summary.offen })}</Text>
                  </TouchableOpacity>
                ) : null}
                <View className="flex-row" style={{ gap: 12 }}>
                  <TouchableOpacity onPress={() => void close()} disabled={att.busy} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
                    <Text className="text-primary dark:text-primary-dark font-bold">{t('att.close.confirm')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirmClose(false)} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark font-semibold">{t('ui.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setConfirmClose(true)}
                accessibilityRole="button"
                className="border border-border dark:border-border-dark rounded-xl items-center justify-center mb-3"
                style={{ minHeight: 48 }}
              >
                <Text className="text-foreground dark:text-foreground-dark font-semibold">{t('att.close.open')}</Text>
              </TouchableOpacity>
            )
          ) : null}

          {view.corrections.length > 0 ? (
            <View className="mb-2">
              <TouchableOpacity
                onPress={() => setShowCorrections((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showCorrections }}
                className="justify-center"
                style={{ minHeight: 44 }}
              >
                <Text className="text-primary dark:text-primary-dark font-semibold">{t('att.corrections.title', { count: view.corrections.length })}</Text>
              </TouchableOpacity>
              {showCorrections
                ? view.corrections.map((c, i) => (
                    <View key={`${c.changedAt}-${i}`} className="mb-2">
                      <Text className="text-foreground dark:text-foreground-dark text-sm">
                        {c.displayName ?? '—'}: {c.oldStatus ? t(`att.status.${c.oldStatus}`) : t('att.status.open')} → {c.newStatus ? t(`att.status.${c.newStatus}`) : t('att.status.open')}
                      </Text>
                      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                        {new Date(c.changedAt).toLocaleString(language)} · {c.reason}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </FormSheet>
  );
}
