import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { addDaysKey, dayKey, groupByDay, privacyErrorKeyOr } from '@/lib/ward';
import { useWardEvents, type WardAnswer, type WardEvent } from '@/hooks/useWardToday';
import type { Ward } from '@/lib/ward';

function Button({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-1 rounded-xl items-center justify-center border ${
        active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'bg-card dark:bg-card-dark border-border dark:border-border-dark'
      } ${disabled ? 'opacity-50' : ''}`}
      style={{ minHeight: 44 }}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Events of the selected child with Zu-/Absage (one tap each; tapping the active answer takes it back). */
export default function WardEventsSection({ ward, events }: { ward: Ward; events: ReturnType<typeof useWardEvents> }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const [failure, setFailure] = useState<string | null>(null);
  const { events: rows, loading, error, reload, respond, pending } = events;
  const name = ward.firstName ?? ward.name;

  const answer = async (event: WardEvent, next: WardAnswer) => {
    setFailure(null);
    const res = await respond(event.id, event.response === next ? null : next);
    if (!res.ok) setFailure(t(privacyErrorKeyOr(res.error, 'heute.events.respond-failed'), { name }));
  };

  const todayKey = dayKey(new Date());
  const tomorrowKey = addDaysKey(new Date(), 1);
  const dayLabel = (key: string) => {
    if (key === todayKey) return t('heute.events.today');
    if (key === tomorrowKey) return t('heute.events.tomorrow');
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y!, m! - 1, d).toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <View className="mb-4">
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-bold text-base mb-2">
        {t('heute.events.title')}
      </Text>
      {loading && rows.length === 0 && !error ? (
        <ActivityIndicator color={themeColors.primary} />
      ) : error && rows.length === 0 ? (
        <View>
          <Text className="text-destructive dark:text-destructive-dark text-sm">{apiErrorMessage(error, t, 'heute.events.error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
            <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('heute.events.empty')}</Text>
      ) : (
        groupByDay(rows).map((group) => (
          <View key={group.day} className="mb-3">
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-bold uppercase tracking-wider mb-1.5">{dayLabel(group.day)}</Text>
            {group.events.map((event) => {
              const start = new Date(event.startsAt);
              const cancelled = !!event.cancelledAt;
              const busy = pending === event.id;
              return (
                <View key={event.id} className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-2">
                  <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                    <View className="flex-1">
                      <Text className={`text-foreground dark:text-foreground-dark text-base font-bold ${cancelled ? 'line-through' : ''}`}>{event.title}</Text>
                      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
                        {[start.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' }), event.locationName, event.calendarName].filter(Boolean).join(' - ')}
                      </Text>
                    </View>
                    {cancelled ? (
                      <View className="bg-destructive rounded-full px-2 py-0.5">
                        <Text className="text-xs font-bold text-white">{t('heute.events.cancelled')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {cancelled && event.cancelReason ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{event.cancelReason}</Text> : null}
                  {event.canRespond ? (
                    <View className="flex-row mt-2" style={{ gap: 8 }}>
                      <Button label={t('heute.events.accept')} active={event.response === 'angemeldet'} disabled={busy} onPress={() => void answer(event, 'angemeldet')} />
                      <Button label={t('heute.events.decline')} active={event.response === 'abgesagt'} disabled={busy} onPress={() => void answer(event, 'abgesagt')} />
                    </View>
                  ) : !cancelled ? (
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">
                      {event.response ? `${t(`heute.events.status.${event.response}`)}. ` : ''}
                      {t('heute.events.own-account', { name })}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))
      )}
      {failure ? (
        <Text className="text-destructive dark:text-destructive-dark text-sm" accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
    </View>
  );
}
