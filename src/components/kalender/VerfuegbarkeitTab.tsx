import React, { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useAvailability } from '@/hooks/useAvailability';
import Badge from '@/components/ui/Badge';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ListSection from '@/components/ui/ListSection';
import PressScale from '@/components/ui/PressScale';
import Skeleton from '@/components/ui/Skeleton';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import Surface from '@/components/ui/Surface';

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
  const { t, language } = useLanguage();
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
      setError(apiErrorMessage(err, t));
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
      setError(apiErrorMessage(err, t));
    } finally {
      setSavingDay(null);
    }
  };

  const [excDate, setExcDate] = useState<Date | null>(null);
  const [excAvailable, setExcAvailable] = useState(true);
  const [excNote, setExcNote] = useState('');
  const [excSaving, setExcSaving] = useState(false);
  const [excError, setExcError] = useState<string | null>(null);

  const handleAddException = async () => {
    if (!excDate || excSaving) return;
    setExcSaving(true);
    setExcError(null);
    try {
      await createException(toDateString(excDate), excAvailable, excNote);
      setExcDate(null);
      setExcNote('');
      setExcAvailable(true);
    } catch (err) {
      setExcError(apiErrorMessage(err, t));
    } finally {
      setExcSaving(false);
    }
  };

  const handleDeleteException = async (id: string) => {
    setExcError(null);
    try {
      await deleteException(id);
    } catch (err) {
      setExcError(apiErrorMessage(err, t));
    }
  };

  if (loading || !initialized) return <Skeleton shape="rows" lines={4} />;

  const timeInput = 'bg-card dark:bg-card-dark rounded-control px-2 text-[15px] text-center text-foreground dark:text-foreground-dark border border-border-control dark:border-border-control-dark';

  return (
    <>
      {error ? (
        <View className="mb-3">
          <Banner tone="danger" body={error} />
        </View>
      ) : null}

      <ListSection footer={t('verfuegbarkeit.hint')}>
        {WEEKDAY_KEYS.map((key, day) => {
          const row = rows[day] ?? DEFAULT_ROW;
          const dayName = t(`verfuegbarkeit.weekday.${key}`);
          return (
            <View key={key}>
              {day > 0 ? <View className="bg-border dark:bg-border-dark" style={{ height: 1, marginLeft: 16 }} /> : null}
              <View className="flex-row items-center px-4" style={{ minHeight: 60, gap: 8 }}>
                <Text
                  className={`flex-1 text-[17px] leading-[22px] ${row.available ? 'text-foreground dark:text-foreground-dark font-medium' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
                  numberOfLines={1}
                >
                  {dayName}
                </Text>
                {row.available ? (
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <TextInput
                      className={timeInput}
                      style={{ width: 64, minHeight: 44, fontVariant: ['tabular-nums'] }}
                      accessibilityLabel={`${dayName}: ${t('verfuegbarkeit.start-time')}`}
                      placeholder="HH:MM"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      placeholderTextColor={themeColors.mutedForeground}
                      value={row.startTime}
                      onChangeText={(value) => setRows((prev) => ({ ...prev, [day]: { ...(prev[day] ?? DEFAULT_ROW), startTime: value } }))}
                      onBlur={() => void handleTimeBlur(day)}
                    />
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px]">{t('verfuegbarkeit.until')}</Text>
                    <TextInput
                      className={timeInput}
                      style={{ width: 64, minHeight: 44, fontVariant: ['tabular-nums'] }}
                      accessibilityLabel={`${dayName}: ${t('verfuegbarkeit.end-time')}`}
                      placeholder="HH:MM"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      placeholderTextColor={themeColors.mutedForeground}
                      value={row.endTime}
                      onChangeText={(value) => setRows((prev) => ({ ...prev, [day]: { ...(prev[day] ?? DEFAULT_ROW), endTime: value } }))}
                      onBlur={() => void handleTimeBlur(day)}
                    />
                  </View>
                ) : null}
                <Switch
                  accessibilityLabel={dayName}
                  value={row.available}
                  onValueChange={(value) => void handleToggle(day, value)}
                  disabled={savingDay === day}
                  trackColor={{ false: themeColors.borderControl, true: themeColors.primary }}
                  thumbColor={themeColors.card}
                  ios_backgroundColor={themeColors.border}
                />
              </View>
            </View>
          );
        })}
      </ListSection>

      <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 px-1">
        {t('verfuegbarkeit.exceptions.title')}
      </Text>
      <Surface className="overflow-hidden">
        {exceptions.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] p-4">{t('verfuegbarkeit.exceptions.empty')}</Text>
        ) : (
          exceptions.map((exc, i) => (
            <View
              key={exc.id}
              className={`flex-row items-center pl-4 pr-1 ${i === 0 ? '' : 'border-t border-divider dark:border-divider-dark'}`}
              style={{ gap: 8, minHeight: 60 }}
            >
              <View className="flex-1 py-2">
                <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                  <Text className="text-foreground dark:text-foreground-dark text-[15px] leading-[22px] font-medium">
                    {fromDateString(exc.date)?.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  <Badge tone={exc.isAvailable ? 'success' : 'danger'}>
                    {t(exc.isAvailable ? 'verfuegbarkeit.exceptions.available' : 'verfuegbarkeit.exceptions.unavailable')}
                  </Badge>
                </View>
                {exc.note ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-1">{exc.note}</Text> : null}
              </View>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={t('ui.delete')}
                onPress={() => void handleDeleteException(exc.id)}
                className="items-center justify-center"
                style={{ width: 44, height: 44 }}
              >
                <Trash2 size={20} strokeWidth={1.75} color={themeColors.mutedForeground} />
              </PressScale>
            </View>
          ))
        )}

        <View className={`p-4 ${exceptions.length === 0 ? 'border-t border-divider dark:border-divider-dark' : 'border-t border-divider dark:border-divider-dark'}`}>
          <Text className="text-[13px] leading-[18px] font-medium mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('verfuegbarkeit.exceptions.date')}
          </Text>
          <View className="mb-3">
            <DateTimeField mode="date" value={excDate} onChange={setExcDate} />
          </View>

          <View className="flex-row items-center justify-between mb-3" style={{ minHeight: 44 }}>
            <Text className="text-[17px] text-foreground dark:text-foreground-dark">
              {t(excAvailable ? 'verfuegbarkeit.exceptions.available' : 'verfuegbarkeit.exceptions.unavailable')}
            </Text>
            <Switch
              accessibilityLabel={t(excAvailable ? 'verfuegbarkeit.exceptions.available' : 'verfuegbarkeit.exceptions.unavailable')}
              value={excAvailable}
              onValueChange={setExcAvailable}
              trackColor={{ false: themeColors.borderControl, true: themeColors.primary }}
              thumbColor={themeColors.card}
              ios_backgroundColor={themeColors.border}
            />
          </View>

          <Text className="text-[13px] leading-[18px] font-medium mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('verfuegbarkeit.exceptions.note')}
          </Text>
          <TextInput
            className="bg-card dark:bg-card-dark rounded-control px-3 text-[17px] text-foreground dark:text-foreground-dark border border-border-control dark:border-border-control-dark mb-3"
            style={{ minHeight: 48 }}
            placeholderTextColor={themeColors.mutedForeground}
            value={excNote}
            onChangeText={setExcNote}
          />

          {excError ? (
            <View className="mb-3">
              <Banner tone="danger" body={excError} />
            </View>
          ) : null}

          <Button block label={t('verfuegbarkeit.exceptions.add')} onPress={() => void handleAddException()} loading={excSaving} disabled={!excDate} />
        </View>
      </Surface>
    </>
  );
}
