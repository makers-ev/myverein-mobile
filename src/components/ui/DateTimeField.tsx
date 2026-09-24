import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import MonthCalendar, { toDayKey } from './MonthCalendar';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];

interface Props {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** 'date' hides the time row. */
  mode?: 'date' | 'datetime';
  placeholder?: string;
  clearable?: boolean;
}

/** Pressable field that opens a month grid (+ hour/minute chips in datetime mode). */
export default function DateTimeField({ value, onChange, mode = 'datetime', placeholder, clearable }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date());
  const [month, setMonth] = useState<Date>(value ?? new Date());

  const openPicker = () => {
    const base = value ?? roundToQuarter(new Date());
    setDraft(base);
    setMonth(base);
    setOpen(true);
  };

  const setTime = (hours: number, minutes: number) => {
    const next = new Date(draft);
    next.setHours(hours, minutes, 0, 0);
    setDraft(next);
  };

  const label = value
    ? mode === 'date'
      ? value.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
      : value.toLocaleString(language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : (placeholder ?? t('ui.pick-date'));

  return (
    <>
      <TouchableOpacity
        onPress={openPicker}
        className="flex-row items-center border border-border dark:border-border-dark bg-card dark:bg-card-dark rounded-xl px-3 py-2.5"
        style={{ gap: 8 }}
      >
        <CalendarDays size={16} color={themeColors.mutedForeground} />
        <Text className={`flex-1 text-sm ${value ? 'text-foreground dark:text-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}>
          {label}
        </Text>
        {clearable && value ? (
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={8}>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('ui.clear')}</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setOpen(false)}>
          <Pressable className="bg-background dark:bg-background-dark rounded-3xl p-3" onPress={() => undefined}>
            {mode === 'date' ? (
              // Year jumps so far-away dates (e.g. birth dates) don't need dozens of month taps.
              <View className="flex-row items-center justify-center mb-2" style={{ gap: 6 }}>
                {[-10, -1].map((d) => (
                  <Chip key={d} label={String(d)} active={false} onPress={() => setMonth(new Date(month.getFullYear() + d, month.getMonth(), 1))} />
                ))}
                <Text className="text-foreground dark:text-foreground-dark font-bold text-base px-2">{month.getFullYear()}</Text>
                {[1, 10].map((d) => (
                  <Chip key={d} label={`+${d}`} active={false} onPress={() => setMonth(new Date(month.getFullYear() + d, month.getMonth(), 1))} />
                ))}
              </View>
            ) : null}
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              selectedDay={toDayKey(draft)}
              onSelectDay={(_, day) => {
                const next = new Date(day);
                next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
                setDraft(next);
              }}
            />

            {mode === 'datetime' ? (
              <View className="mt-3">
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1 px-1">{t('ui.time')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
                  {HOURS.map((h) => (
                    <Chip key={h} label={String(h).padStart(2, '0')} active={draft.getHours() === h} onPress={() => setTime(h, draft.getMinutes())} />
                  ))}
                </ScrollView>
                <View className="flex-row mt-2 px-1" style={{ gap: 6 }}>
                  {MINUTES.map((m) => (
                    <Chip key={m} label={`:${String(m).padStart(2, '0')}`} active={draft.getMinutes() === m} onPress={() => setTime(draft.getHours(), m)} />
                  ))}
                </View>
              </View>
            ) : null}

            <View className="flex-row mt-4" style={{ gap: 10 }}>
              <TouchableOpacity onPress={() => setOpen(false)} className="flex-1 border border-border dark:border-border-dark rounded-xl py-3 items-center">
                <Text className="text-foreground dark:text-foreground-dark font-semibold">{t('ui.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
                className="flex-1 bg-primary dark:bg-primary-dark rounded-xl py-3 items-center"
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('ui.done')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full border ${
        active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      }`}
    >
      <Text className={`text-sm ${active ? 'text-primary-foreground dark:text-primary-foreground-dark font-bold' : 'text-foreground dark:text-foreground-dark'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function roundToQuarter(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

/** `Date` -> backend `date` column string (`YYYY-MM-DD`, local day). */
export const toDateString = toDayKey;

/** Backend `date` string -> local-midnight `Date`, or null. */
export function fromDateString(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}
