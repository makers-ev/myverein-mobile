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
  /** dayKey -> one entry per event on that day. Shown as neutral dots (1, 2 or 3 for "several"): they only say
   * "something is on"; what it is (and its department colour) is explained in the day list below. */
  markers?: Record<string, string[]>;
}

/**
 * Monday-first month grid (Figma `Calendar day`), pure RN (no picker dependency). Header: month name, previous/next and
 * a "Heute" text action, all 44pt. Today has a ring, the selected day a primary fill, days outside the month are muted.
 * Each cell is at least 44pt and announces the date and the number of events.
 */
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
    const labels = rows[0].map((d) => d.toLocaleDateString(language, { weekday: 'short' }).replace('.', '').slice(0, 2));
    return { weeks: rows, weekdayLabels: labels };
  }, [month, language]);

  const shift = (delta: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const now = new Date();
  const showingToday = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  return (
    <View>
      <View className="flex-row items-center mb-1" style={{ minHeight: 44 }}>
        <Text accessibilityRole="header" className="flex-1 text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
          {month.toLocaleDateString(language, { month: 'long', year: 'numeric' })}
        </Text>
        {!showingToday ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => onMonthChange(new Date())} className="justify-center px-3" style={{ minHeight: 44 }}>
            <Text className="text-primary dark:text-primary-dark text-[15px] font-semibold">{t('ui.today')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="button" onPress={() => shift(-1)} className="items-center justify-center" style={{ width: 44, height: 44 }} accessibilityLabel={t('ui.prev-month')}>
          <ChevronLeft size={22} strokeWidth={1.75} color={themeColors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => shift(1)} className="items-center justify-center" style={{ width: 44, height: 44, marginRight: -10 }} accessibilityLabel={t('ui.next-month')}>
          <ChevronRight size={22} strokeWidth={1.75} color={themeColors.foreground} />
        </TouchableOpacity>
      </View>

      <View className="flex-row" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {weekdayLabels.map((label, i) => (
          <Text key={i} maxFontSizeMultiplier={1.3} className="flex-1 text-center text-muted-foreground dark:text-muted-foreground-dark text-[13px] font-medium mb-1">
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
            const count = (markers[key] ?? []).length;
            const dots = Math.min(count, 3);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={key}
                onPress={() => onSelectDay(key, day)}
                className="flex-1 items-center py-0.5"
                style={{ minHeight: 48 }}
                accessibilityLabel={[
                  day.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' }),
                  isToday ? t('ui.today') : null,
                  count > 0 ? t('ui.events-count', { count }) : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                <View
                  className={`rounded-full items-center justify-center ${
                    selected ? 'bg-primary dark:bg-primary-dark' : isToday ? 'border-2 border-primary-text dark:border-primary-text-dark' : ''
                  }`}
                  style={{ width: 38, height: 38 }}
                >
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={{ fontVariant: ['tabular-nums'] }}
                    className={`text-[17px] ${
                      selected
                        ? 'text-primary-foreground dark:text-primary-foreground-dark font-semibold'
                        : isToday
                          ? 'text-foreground dark:text-foreground-dark font-semibold'
                          : inMonth
                            ? 'text-foreground dark:text-foreground-dark'
                            : 'text-muted-foreground dark:text-muted-foreground-dark'
                    }`}
                  >
                    {day.getDate()}
                  </Text>
                </View>
                <View className="flex-row mt-0.5" style={{ gap: 3, height: 5 }}>
                  {Array.from({ length: dots }, (_, i) => (
                    <View key={i} className="bg-muted-foreground dark:bg-muted-foreground-dark" style={{ width: 5, height: 5, borderRadius: 3 }} />
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
