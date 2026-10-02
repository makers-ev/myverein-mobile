import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

/** Local-time `YYYY-MM-DD`, the key used for `markers` and selection. */
export function toDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

interface Props {
  /** Any date inside the month to show. */
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDay?: string | null;
  onSelectDay: (dayKey: string, date: Date) => void;
  /** dayKey -> dot colors (max 3 shown). */
  markers?: Record<string, string[]>;
}

/** Monday-first month grid, pure RN (no picker dependency). */
export default function MonthCalendar({ month, onMonthChange, selectedDay, onSelectDay, markers = {} }: Props) {
  const { language, t } = useLanguage();
  const themeColors = useThemeColors();
  const todayKey = toDayKey(new Date());

  const { weeks, weekdayLabels } = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const rows = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
    // Drop a trailing week that lies fully in the next month.
    if (rows[5][0].getMonth() !== month.getMonth()) rows.pop();
    const labels = rows[0].map((d) => d.toLocaleDateString(language, { weekday: 'narrow' }));
    return { weeks: rows, weekdayLabels: labels };
  }, [month, language]);

  const shift = (delta: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3">
      <View className="flex-row items-center justify-between mb-2">
        <TouchableOpacity onPress={() => shift(-1)} className="p-2" accessibilityLabel={t('ui.prev-month')}>
          <ChevronLeft size={20} color={themeColors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMonthChange(new Date())}>
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base">
            {month.toLocaleDateString(language, { month: 'long', year: 'numeric' })}
          </Text>
          <Text className="text-primary dark:text-primary-dark text-xs text-center">{t('ui.today')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shift(1)} className="p-2" accessibilityLabel={t('ui.next-month')}>
          <ChevronRight size={20} color={themeColors.foreground} />
        </TouchableOpacity>
      </View>

      <View className="flex-row">
        {weekdayLabels.map((label, i) => (
          <Text key={i} className="flex-1 text-center text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} className="flex-row">
          {week.map((day) => {
            const key = toDayKey(day);
            const inMonth = day.getMonth() === month.getMonth();
            const selected = key === selectedDay;
            const isToday = key === todayKey;
            const dots = markers[key] ?? [];
            return (
              <TouchableOpacity
                key={key}
                onPress={() => onSelectDay(key, day)}
                className="flex-1 items-center py-1"
                accessibilityLabel={day.toLocaleDateString(language)}
              >
                <View
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    selected ? 'bg-primary dark:bg-primary-dark' : isToday ? 'border border-primary dark:border-primary-dark' : ''
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selected
                        ? 'text-primary-foreground dark:text-primary-foreground-dark font-bold'
                        : inMonth
                          ? 'text-foreground dark:text-foreground-dark'
                          : 'text-muted-foreground dark:text-muted-foreground-dark opacity-50'
                    }`}
                  >
                    {day.getDate()}
                  </Text>
                </View>
                <View className="flex-row h-1.5 mt-0.5" style={{ gap: 2 }}>
                  {dots.slice(0, 3).map((color, i) => (
                    <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
