import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { WEEKDAYS, type RecurrenceDraft, type SeriesFreq, type SeriesPreview, type SetPos, type Weekday } from '@/lib/eventSeries';
import { Field, inputClassName } from '@/components/ui/FormSheet';
import DateTimeField from '@/components/ui/DateTimeField';
import NotifySwitch from '@/components/ui/NotifySwitch';
import { ColorChip } from './ColorChip';

interface Props {
  draft: RecurrenceDraft;
  onChange: (draft: RecurrenceDraft) => void;
  /** Start of the first occurrence: drives the default weekday and the monthly "n-th weekday" label. */
  start: Date | null;
  /** Offer "repeats not" (creating); when editing a series the rule is always on. */
  allowNone: boolean;
  /** Club federal state; `null`/`undefined` while "skip holidays" is on shows the hint. */
  clubState?: string | null;
  /** Body for the live preview (`POST /event-series/preview`), null disables it. */
  previewBody: Record<string, unknown> | null;
  previewSeries?: (body: Record<string, unknown>, limit?: number) => Promise<SeriesPreview>;
}

const FREQS: SeriesFreq[] = ['daily', 'weekly', 'monthly'];
const SET_POS: SetPos[] = [1, 2, 3, 4, -1];

/** Live list of the first occurrences, debounced; nothing is stored. */
function SeriesPreviewList({ body, previewSeries }: { body: Record<string, unknown>; previewSeries: NonNullable<Props['previewSeries']> }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const [preview, setPreview] = useState<SeriesPreview | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const key = JSON.stringify(body);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(null);
      previewSeries(JSON.parse(key) as Record<string, unknown>)
        .then((data) => {
          if (id === requestId.current) setPreview(data);
        })
        .catch((err) => {
          if (id === requestId.current) setFailed(apiErrorMessage(err, t));
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, previewSeries]);

  return (
    <View className="border border-border dark:border-border-dark rounded-xl p-3 mb-3" accessibilityLiveRegion="polite">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">{t('series.preview.title')}</Text>
      {loading ? <ActivityIndicator color={themeColors.primary} /> : null}
      {!loading && failed ? <Text className="text-destructive text-sm">{failed}</Text> : null}
      {!loading && !failed && preview ? (
        preview.occurrences.length === 0 ? (
          <Text className="text-foreground dark:text-foreground-dark text-sm">{t('series.preview.none')}</Text>
        ) : (
          <View style={{ gap: 2 }}>
            {preview.occurrences.map((o) => (
              <Text key={o.startsAt} className="text-foreground dark:text-foreground-dark text-sm">
                {new Date(o.startsAt).toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ))}
            {!preview.finished ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('series.preview.more')}</Text> : null}
            {preview.skippedHolidays.length > 0 ? (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">
                {t('series.preview.holidays', { list: preview.skippedHolidays.map((h) => h.holiday).join(', ') })}
              </Text>
            ) : null}
          </View>
        )
      ) : null}
    </View>
  );
}

/** "Wiederholen" section of the event form: frequency, interval, weekdays, end and holiday switch. */
export default function RecurrenceEditor({ draft, onChange, start, allowNone, clubState, previewBody, previewSeries }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const patch = (next: Partial<RecurrenceDraft>) => onChange({ ...draft, ...next });

  const weekdayLabel = (day: Weekday) => {
    // 2024-01-01 was a Monday.
    const date = new Date(2024, 0, 1 + WEEKDAYS.indexOf(day));
    return date.toLocaleDateString(language, { weekday: 'short' });
  };
  const toggleDay = (day: Weekday) =>
    patch({ byDay: draft.byDay.includes(day) ? draft.byDay.filter((d) => d !== day) : [...draft.byDay, day] });
  const unit = draft.freq === 'daily' ? 'series.unit.days' : draft.freq === 'weekly' ? 'series.unit.weeks' : 'series.unit.months';
  const startWeekday = start ? weekdayLabel(WEEKDAYS[(start.getDay() + 6) % 7]) : '';

  return (
    <View className="mb-1">
      <Field label={t('series.repeat')}>
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {allowNone ? <ColorChip label={t('series.freq.none')} active={draft.freq === null} onPress={() => patch({ freq: null })} /> : null}
          {FREQS.map((freq) => (
            <ColorChip key={freq} label={t(`series.freq.${freq}`)} active={draft.freq === freq} onPress={() => patch({ freq })} />
          ))}
        </View>
      </Field>

      {draft.freq ? (
        <>
          <Field label={t('series.interval')}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-foreground dark:text-foreground-dark text-sm">{t('series.every')}</Text>
              <TextInput
                className={inputClassName}
                style={{ width: 70, textAlign: 'center' }}
                value={draft.interval}
                onChangeText={(v) => patch({ interval: v.replace(/[^0-9]/g, '').slice(0, 2) })}
                keyboardType="number-pad"
                accessibilityLabel={t('series.interval')}
                placeholderTextColor={themeColors.mutedForeground}
              />
              <Text className="text-foreground dark:text-foreground-dark text-sm">{t(unit)}</Text>
            </View>
          </Field>

          {draft.freq === 'weekly' ? (
            <Field label={t('series.weekdays')}>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {WEEKDAYS.map((day) => (
                  <ColorChip key={day} label={weekdayLabel(day)} active={draft.byDay.includes(day)} onPress={() => toggleDay(day)} />
                ))}
              </View>
            </Field>
          ) : null}

          {draft.freq === 'monthly' ? (
            <Field label={t('series.monthly')}>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                <ColorChip
                  label={t('series.monthly.day', { day: start ? start.getDate() : '' })}
                  active={draft.monthlyMode === 'day'}
                  onPress={() => patch({ monthlyMode: 'day' })}
                />
                <ColorChip label={t('series.monthly.nth')} active={draft.monthlyMode === 'nth'} onPress={() => patch({ monthlyMode: 'nth' })} />
              </View>
              {draft.monthlyMode === 'day' && start && start.getDate() > 28 ? (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t('series.monthly.skip-hint')}</Text>
              ) : null}
              {draft.monthlyMode === 'nth' ? (
                <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
                  {SET_POS.map((pos) => (
                    <ColorChip key={pos} label={t(`series.setpos.${pos}`, { weekday: startWeekday })} active={draft.bySetPos === pos} onPress={() => patch({ bySetPos: pos })} />
                  ))}
                </View>
              ) : null}
            </Field>
          ) : null}

          <Field label={t('series.end')}>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              <ColorChip label={t('series.end.never')} active={draft.end === 'never'} onPress={() => patch({ end: 'never' })} />
              <ColorChip label={t('series.end.until')} active={draft.end === 'until'} onPress={() => patch({ end: 'until' })} />
              <ColorChip label={t('series.end.count')} active={draft.end === 'count'} onPress={() => patch({ end: 'count' })} />
            </View>
            {draft.end === 'until' ? (
              <View className="mt-2">
                <DateTimeField mode="date" value={draft.untilDate} onChange={(value) => patch({ untilDate: value })} />
              </View>
            ) : null}
            {draft.end === 'count' ? (
              <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                <TextInput
                  className={inputClassName}
                  style={{ width: 90, textAlign: 'center' }}
                  value={draft.count}
                  onChangeText={(v) => patch({ count: v.replace(/[^0-9]/g, '').slice(0, 4) })}
                  keyboardType="number-pad"
                  accessibilityLabel={t('series.end.count')}
                  placeholderTextColor={themeColors.mutedForeground}
                />
                <Text className="text-foreground dark:text-foreground-dark text-sm">{t('series.occurrences')}</Text>
              </View>
            ) : null}
            {draft.end === 'never' ? (
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t('series.end.never-hint')}</Text>
            ) : null}
          </Field>

          <NotifySwitch
            label={t('series.skip-holidays')}
            hint={draft.skipHolidays && clubState == null ? t('series.skip-holidays.no-state') : t('series.skip-holidays.hint')}
            value={draft.skipHolidays}
            onChange={(value) => patch({ skipHolidays: value })}
          />

          {previewBody && previewSeries ? <SeriesPreviewList body={previewBody} previewSeries={previewSeries} /> : null}
        </>
      ) : null}
    </View>
  );
}
