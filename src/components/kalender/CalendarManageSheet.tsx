import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronRight, X } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { useCalendarAdmin, type Calendar, type CalendarVisibility } from '@/hooks/useCalendars';
import type { Department } from '@/hooks/useClubInfo';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import { ColorChip } from './EventSheet';

const ROLE_TYPES = [
  'vorsitz',
  'stellv_vorsitz',
  'kassenwart',
  'schriftfuehrer',
  'beisitzer',
  'abteilungsleitung',
  'trainer',
  'erziehungsberechtigt',
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  calendars: Calendar[];
  departments: Department[];
  colorFor: (calendarId: string) => string;
  onChanged: () => void;
}

/** Board-side calendar management: create, rename, department, delete, visibility grants. */
export default function CalendarManageSheet({ visible, onClose, clubId, calendars, departments, colorFor, onChanged }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { createCalendar } = useCalendarAdmin(clubId, onChanged);

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      await createCalendar(name.trim(), departmentId);
      setName('');
      setDepartmentId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <FormSheet visible={visible} title={t('kalender.manage.title')} onClose={onClose} cancelLabel={t('ui.done')} error={error}>
      {calendars.map((cal) => (
        <CalendarCard
          key={cal.id}
          clubId={clubId}
          calendar={cal}
          color={colorFor(cal.id)}
          departments={departments}
          expanded={expandedId === cal.id}
          onToggle={() => setExpandedId((prev) => (prev === cal.id ? null : cal.id))}
          onChanged={onChanged}
          onError={setError}
        />
      ))}

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mt-2">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('kalender.manage.create')}</Text>
        <Field label={t('kalender.manage.name')}>
          <TextInput
            className={inputClassName}
            value={name}
            onChangeText={setName}
            maxLength={200}
            placeholderTextColor={themeColors.mutedForeground}
          />
        </Field>
        {departments.length > 0 ? (
          <Field label={t('kalender.manage.department')}>
            <DepartmentPicker departments={departments} value={departmentId} onChange={setDepartmentId} />
          </Field>
        ) : null}
        <TouchableOpacity
          className={`bg-primary dark:bg-primary-dark rounded-xl py-3 items-center ${!name.trim() || creating ? 'opacity-50' : ''}`}
          onPress={() => void handleCreate()}
          disabled={!name.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator color={themeColors.primaryForeground} size="small" />
          ) : (
            <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold text-sm">{t('kalender.manage.create')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </FormSheet>
  );
}

function DepartmentPicker({
  departments,
  value,
  onChange,
  disabled,
}: {
  departments: Department[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      <ColorChip label={t('kalender.manage.no-department')} active={value === null} onPress={() => onChange(null)} disabled={disabled} />
      {departments.map((d) => (
        <ColorChip key={d.id} label={d.name} active={value === d.id} onPress={() => onChange(d.id)} disabled={disabled} />
      ))}
    </View>
  );
}

function CalendarCard({
  clubId,
  calendar,
  color,
  departments,
  expanded,
  onToggle,
  onChanged,
  onError,
}: {
  clubId: string;
  calendar: Calendar;
  color: string;
  departments: Department[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { updateCalendar, deleteCalendar, listVisibility, addVisibility, removeVisibility } = useCalendarAdmin(clubId, onChanged);

  const [name, setName] = useState(calendar.name);
  const [grants, setGrants] = useState<CalendarVisibility[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Ref guard: state alone lets a fast double tap through before re-render.
  const busyRef = useRef(false);

  useEffect(() => {
    if (!expanded || grants) return;
    listVisibility(calendar.id)
      .then(setGrants)
      .catch((err) => {
        setGrants([]);
        onError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
      });
  }, [expanded, grants, calendar.id, listVisibility, onError, t]);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    onError(null);
    try {
      await action();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const departmentName = (id: string | null) => departments.find((d) => d.id === id)?.name;

  const grantLabel = (g: CalendarVisibility) =>
    g.roleType ? t(`verein.role.${g.roleType}`) : g.departmentId ? (departmentName(g.departmentId) ?? '—') : t('kalender.manage.grant.member');

  const confirmDelete = () =>
    Alert.alert(t('kalender.manage.delete.title'), t('kalender.manage.delete.message', { name: calendar.name }), [
      { text: t('ui.cancel'), style: 'cancel' },
      { text: t('ui.delete'), style: 'destructive', onPress: () => void run(() => deleteCalendar(calendar.id)) },
    ]);

  const grantedRoles = new Set(grants?.map((g) => g.roleType));
  const grantedDepartments = new Set(grants?.map((g) => g.departmentId));

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl mb-3 overflow-hidden">
      <TouchableOpacity onPress={onToggle} className="flex-row items-center p-3" style={{ gap: 10 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        <View className="flex-1">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">{calendar.name}</Text>
          {calendar.departmentId ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{departmentName(calendar.departmentId)}</Text>
          ) : null}
        </View>
        {calendar.isDefault ? (
          <View className="bg-primary/10 dark:bg-primary-dark/10 px-2 py-0.5 rounded-full">
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('kalender.manage.default')}</Text>
          </View>
        ) : null}
        {expanded ? <ChevronDown size={18} color={themeColors.mutedForeground} /> : <ChevronRight size={18} color={themeColors.mutedForeground} />}
      </TouchableOpacity>

      {expanded ? (
        <View className="px-3 pb-3 border-t border-border dark:border-border-dark pt-3">
          <Field label={t('kalender.manage.name')}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TextInput
                className={`flex-1 ${inputClassName}`}
                value={name}
                onChangeText={setName}
                maxLength={200}
                placeholderTextColor={themeColors.mutedForeground}
              />
              <TouchableOpacity
                onPress={() => void run(() => updateCalendar(calendar.id, { name: name.trim() }))}
                disabled={busy || !name.trim() || name.trim() === calendar.name}
                className={`bg-primary dark:bg-primary-dark rounded-xl px-3 py-2.5 ${busy || !name.trim() || name.trim() === calendar.name ? 'opacity-50' : ''}`}
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold text-sm">{t('ui.save')}</Text>
              </TouchableOpacity>
            </View>
          </Field>

          {departments.length > 0 ? (
            <Field label={t('kalender.manage.department')}>
              <DepartmentPicker
                departments={departments}
                value={calendar.departmentId}
                onChange={(id) => void run(() => updateCalendar(calendar.id, { departmentId: id }))}
                disabled={busy}
              />
            </Field>
          ) : null}

          <Field label={t('kalender.manage.visibility')}>
            {grants === null ? (
              <ActivityIndicator color={themeColors.primary} />
            ) : (
              <>
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">
                  {grants.length === 0 ? t('kalender.manage.visibility.empty') : t('kalender.manage.visibility.hint')}
                </Text>
                <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
                  {grants.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          await removeVisibility(calendar.id, g.id);
                          setGrants((prev) => prev?.filter((x) => x.id !== g.id) ?? null);
                        })
                      }
                      className="flex-row items-center bg-muted dark:bg-muted-dark rounded-full pl-3 pr-2 py-1.5"
                      style={{ gap: 4 }}
                      accessibilityLabel={`${t('ui.delete')} ${grantLabel(g)}`}
                    >
                      <Text className="text-foreground dark:text-foreground-dark text-sm">{grantLabel(g)}</Text>
                      <X size={14} color={themeColors.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">
                  {t('kalender.manage.add-role')}
                </Text>
                <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
                  {ROLE_TYPES.filter((r) => !grantedRoles.has(r)).map((r) => (
                    <ColorChip
                      key={r}
                      label={`+ ${t(`verein.role.${r}`)}`}
                      active={false}
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          const created = await addVisibility(calendar.id, { roleType: r });
                          setGrants((prev) => [...(prev ?? []), created]);
                        })
                      }
                    />
                  ))}
                </View>

                {departments.some((d) => !grantedDepartments.has(d.id)) ? (
                  <>
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">
                      {t('kalender.manage.add-department')}
                    </Text>
                    <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
                      {departments
                        .filter((d) => !grantedDepartments.has(d.id))
                        .map((d) => (
                          <ColorChip
                            key={d.id}
                            label={`+ ${d.name}`}
                            active={false}
                            disabled={busy}
                            onPress={() =>
                              void run(async () => {
                                const created = await addVisibility(calendar.id, { departmentId: d.id });
                                setGrants((prev) => [...(prev ?? []), created]);
                              })
                            }
                          />
                        ))}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </Field>

          <TouchableOpacity onPress={confirmDelete} disabled={busy} className="self-start py-1">
            <Text className="text-destructive text-sm font-semibold">{t('kalender.manage.delete')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
