import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { useAvailability } from '@/hooks/useAvailability';

interface Props {
  clubId: string;
}

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

interface RowState {
  available: boolean;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

const DEFAULT_ROW: RowState = { available: false, startTime: '18:00', endTime: '20:00' };

/**
 * Recurring weekly availability, one fixed row per weekday (Mo..So, always
 * visible) so this reads as a guided grid rather than a raw "add a slot"
 * form -- see the exceptions list below for the one-off-date counterpart.
 */
export default function VerfuegbarkeitTab({ clubId }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { slots, exceptions, loading, upsertSlot, deleteSlotForWeekday, createException, deleteException } =
    useAvailability(clubId);

  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [initialized, setInitialized] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seeded once from the fetched slots, then owned locally -- re-deriving
  // from `slots` on every render would clobber whatever the member is
  // currently typing in an untouched day's time fields.
  useEffect(() => {
    if (loading || initialized) return;
    const next: Record<number, RowState> = {};
    for (let day = 0; day < 7; day++) {
      const slot = slots.find((s) => s.weekday === day);
      next[day] = slot
        ? { available: true, startTime: slot.startTime.slice(0, 5), endTime: slot.endTime.slice(0, 5) }
        : { ...DEFAULT_ROW };
    }
    setRows(next);
    setInitialized(true);
  }, [loading, slots, initialized]);

  const handleToggle = async (day: number, value: boolean) => {
    const row = rows[day] ?? DEFAULT_ROW;
    setRows((prev) => ({ ...prev, [day]: { ...row, available: value } }));
    setError(null);
    setSavingDay(day);
    try {
      if (value) {
        await upsertSlot(day, `${row.startTime || DEFAULT_ROW.startTime}:00`, `${row.endTime || DEFAULT_ROW.endTime}:00`);
      } else {
        await deleteSlotForWeekday(day);
      }
    } catch (err) {
      setRows((prev) => ({ ...prev, [day]: { ...row, available: !value } }));
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setSavingDay(null);
    }
  };

  const handleTimeBlur = async (day: number) => {
    const row = rows[day];
    if (!row?.available || !row.startTime.trim() || !row.endTime.trim()) return;
    setError(null);
    setSavingDay(day);
    try {
      await upsertSlot(day, `${row.startTime}:00`, `${row.endTime}:00`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setSavingDay(null);
    }
  };

  const [excDate, setExcDate] = useState('');
  const [excAvailable, setExcAvailable] = useState(true);
  const [excNote, setExcNote] = useState('');
  const [excSaving, setExcSaving] = useState(false);
  const [excError, setExcError] = useState<string | null>(null);

  const handleAddException = async () => {
    if (!excDate.trim() || excSaving) return;
    setExcSaving(true);
    setExcError(null);
    try {
      await createException(excDate.trim(), excAvailable, excNote);
      setExcDate('');
      setExcNote('');
      setExcAvailable(true);
    } catch (err) {
      setExcError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setExcSaving(false);
    }
  };

  const handleDeleteException = async (id: string) => {
    setExcError(null);
    try {
      await deleteException(id);
    } catch (err) {
      setExcError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    }
  };

  if (loading || !initialized) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}

        {WEEKDAY_KEYS.map((key, day) => {
          const row = rows[day] ?? DEFAULT_ROW;
          const isLast = day === WEEKDAY_KEYS.length - 1;
          return (
            <View key={key} className={`py-3 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}>
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                  {t(`verfuegbarkeit.weekday.${key}`)}
                </Text>
                <Switch
                  value={row.available}
                  onValueChange={(value) => void handleToggle(day, value)}
                  disabled={savingDay === day}
                  trackColor={{ false: themeColors.border, true: themeColors.primary }}
                  thumbColor={themeColors.card}
                  ios_backgroundColor={themeColors.border}
                />
              </View>

              {row.available && (
                <View className="flex-row items-center mt-2" style={{ gap: 10 }}>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">
                      {t('verfuegbarkeit.start-time')}
                    </Text>
                    <TextInput
                      className="bg-muted dark:bg-muted-dark rounded-lg p-2.5 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark"
                      placeholder="HH:MM"
                      placeholderTextColor={themeColors.mutedForeground}
                      value={row.startTime}
                      onChangeText={(value) => setRows((prev) => ({ ...prev, [day]: { ...(prev[day] ?? DEFAULT_ROW), startTime: value } }))}
                      onBlur={() => void handleTimeBlur(day)}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">
                      {t('verfuegbarkeit.end-time')}
                    </Text>
                    <TextInput
                      className="bg-muted dark:bg-muted-dark rounded-lg p-2.5 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark"
                      placeholder="HH:MM"
                      placeholderTextColor={themeColors.mutedForeground}
                      value={row.endTime}
                      onChangeText={(value) => setRows((prev) => ({ ...prev, [day]: { ...(prev[day] ?? DEFAULT_ROW), endTime: value } }))}
                      onBlur={() => void handleTimeBlur(day)}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('verfuegbarkeit.exceptions.title')}</Text>

        {exceptions.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('verfuegbarkeit.exceptions.empty')}</Text>
        ) : (
          exceptions.map((exc, i) => (
            <View
              key={exc.id}
              className={`flex-row items-start justify-between py-2 ${i === exceptions.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}
              style={{ gap: 8 }}
            >
              <View className="flex-1">
                <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                  <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">{exc.date}</Text>
                  <View className={`px-2 py-0.5 rounded-full ${exc.isAvailable ? 'bg-success/10' : 'bg-destructive/10'}`}>
                    <Text className={`text-xs font-semibold ${exc.isAvailable ? 'text-success dark:text-success-dark' : 'text-destructive'}`}>
                      {t(exc.isAvailable ? 'verfuegbarkeit.exceptions.available' : 'verfuegbarkeit.exceptions.unavailable')}
                    </Text>
                  </View>
                </View>
                {exc.note ? (
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{exc.note}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => void handleDeleteException(exc.id)} hitSlop={8} className="p-1">
                <Trash2 size={18} color={themeColors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View className="mt-4 pt-4 border-t border-border dark:border-border-dark">
          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('verfuegbarkeit.exceptions.date')}
          </Text>
          <TextInput
            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={themeColors.mutedForeground}
            value={excDate}
            onChangeText={setExcDate}
          />

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-foreground dark:text-foreground-dark">
              {t(excAvailable ? 'verfuegbarkeit.exceptions.available' : 'verfuegbarkeit.exceptions.unavailable')}
            </Text>
            <Switch
              value={excAvailable}
              onValueChange={setExcAvailable}
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
              thumbColor={themeColors.card}
              ios_backgroundColor={themeColors.border}
            />
          </View>

          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('verfuegbarkeit.exceptions.note')}
          </Text>
          <TextInput
            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
            placeholderTextColor={themeColors.mutedForeground}
            value={excNote}
            onChangeText={setExcNote}
          />

          {excError ? <Text className="text-destructive text-sm mb-3">{excError}</Text> : null}

          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-3 items-center ${excSaving ? 'opacity-70' : ''}`}
            onPress={() => void handleAddException()}
            disabled={excSaving}
          >
            {excSaving ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
                {t('verfuegbarkeit.exceptions.add')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
