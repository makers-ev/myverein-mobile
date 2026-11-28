import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Play, Square, Trash2, TriangleAlert } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { canDeleteEntry, elapsedMinutes, formatDuration, runningState, timeErrorKey, totalMinutes } from '@/lib/timeTracking';
import FormSheet from '@/components/ui/FormSheet';
import Button from '@/components/ui/Button';
import Banner from '@/components/ui/Banner';
import { useConfirm } from '@/hooks/useConfirm';

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  /** Opened from an event: the stamp is linked to it. */
  eventId?: string | null;
  eventTitle?: string | null;
}

function LinkButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`justify-center px-3 ${disabled ? 'opacity-50' : ''}`}
      style={{ minHeight: 44 }}
    >
      <Text className={`text-sm font-semibold ${danger ? 'text-destructive dark:text-destructive-dark' : 'text-primary dark:text-primary-dark'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Time stamp for trainers (Wave 12 P2): start / stop, this month's own entries, proposals from attendance lists. A report
 * for the club's records -- no payout, no amounts.
 */
export default function TimeSheet({ visible, onClose, clubId, eventId, eventTitle }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const time = useTimeTracking(clubId, visible);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const alive = useRef(true);
  const { confirm } = useConfirm();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!visible) {
      setError(null);
      return;
    }
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [visible]);

  const run = async (key: string, job: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await job();
    } catch (err) {
      if (alive.current) {
        setError(t(timeErrorKey(err)));
        void time.reload();
      }
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const running = time.current;
  const runningMinutes = running ? elapsedMinutes(running.startedAt, now) : 0;
  const state = runningState(runningMinutes);
  const startedLabel = running
    ? `${new Date(running.startedAt).toLocaleDateString(language, { day: 'numeric', month: 'short' })}, ${new Date(running.startedAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const discard = async () => {
    if (!running || busy) return;
    const ok = await confirm({ title: t('time.discard.title'), message: t('time.discard.message'), confirmLabel: t('time.discard'), destructive: true });
    if (ok) await run('discard', () => time.discardRunning(running.id));
  };
  const finished = time.entries.filter((e) => !e.running);

  return (
    <FormSheet visible={visible} title={t('time.title')} onClose={onClose} cancelLabel={t('ui.done')} error={error}>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('time.note')}</Text>

      {time.loading ? (
        <View className="py-8 items-center" accessibilityLabel={t('time.loading')}>
          <ActivityIndicator color={themeColors.primaryText} />
        </View>
      ) : time.error && time.entries.length === 0 && !running ? (
        <View className="py-4">
          <Text className="text-destructive dark:text-destructive-dark text-sm mb-2">{apiErrorMessage(time.error, t)}</Text>
          <LinkButton label={t('connection.retry')} onPress={() => void time.reload()} />
        </View>
      ) : (
        <View>
          <View className="border border-border dark:border-border-dark rounded-control p-3 mb-4" accessibilityLiveRegion="polite">
            {running ? (
              <>
                <Text className="text-foreground dark:text-foreground-dark text-base font-semibold">{t('time.running', { duration: formatDuration(elapsedMinutes(running.startedAt, now)) })}</Text>
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">
                  {running.eventTitle ? `${running.eventTitle} · ` : ''}
                  {t('time.since', { time: new Date(running.startedAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' }) })}
                </Text>
                {state !== 'ok' ? (
                  <View className="mb-3">
                    <Banner
                      tone={state === 'too-long' ? 'danger' : 'warning'}
                      icon={TriangleAlert}
                      title={t('time.stale.title', { since: startedLabel, duration: formatDuration(runningMinutes) })}
                      body={t(state === 'too-long' ? 'time.stale.too-long' : 'time.stale.body')}
                      alert
                    />
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={() => void run('out', () => time.clockOut())}
                  disabled={!!busy}
                  accessibilityRole="button"
                  className={`flex-row items-center justify-center bg-destructive rounded-control ${busy ? 'opacity-60' : ''}`}
                  style={{ gap: 8, minHeight: 52 }}
                >
                  <Square size={18} color="#FFFFFF" />
                  <Text className="text-white font-semibold">{t('time.stop')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void discard()}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel={t('time.discard')}
                  accessibilityState={{ disabled: !!busy }}
                  className={`flex-row items-center justify-center mt-2 ${busy ? 'opacity-50' : ''}`}
                  style={{ gap: 8, minHeight: 44 }}
                >
                  <Trash2 size={16} color={themeColors.destructive} />
                  <Text className="text-destructive dark:text-destructive-dark text-sm font-semibold">{t('time.discard')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text className="text-foreground dark:text-foreground-dark text-sm mb-2">{eventTitle ? t('time.start-for', { title: eventTitle }) : t('time.idle')}</Text>
                <Button block icon={Play} label={t('time.start')} onPress={() => void run('in', () => time.clockIn(eventId ?? null))} disabled={!!busy || time.currentLoading} />
              </>
            )}
          </View>

          {time.suggestions.length > 0 ? (
            <View className="mb-4">
              <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('time.suggestions')}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-1">{t('time.suggestions.hint')}</Text>
              {time.suggestions.map((s) => (
                <View key={s.eventId} className="flex-row items-center border-b border-divider dark:border-divider-dark">
                  <View className="flex-1 py-2">
                    <Text className="text-foreground dark:text-foreground-dark text-sm">{s.title}</Text>
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                      {new Date(s.startsAt).toLocaleDateString(language, { day: 'numeric', month: 'short' })} · {new Date(s.startsAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}–
                      {new Date(s.endsAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <LinkButton label={t('time.take-over')} disabled={!!busy} onPress={() => void run(s.eventId, () => time.fromEvent(s.eventId))} />
                </View>
              ))}
            </View>
          ) : null}

          <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('time.month')}</Text>
          {finished.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-1">{t('time.empty')}</Text>
          ) : (
            <View>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-1">{t('time.total', { duration: formatDuration(totalMinutes(finished)) })}</Text>
              {finished.map((e) => (
                <View key={e.id} className="flex-row items-center border-b border-divider dark:border-divider-dark">
                  <View className="flex-1 py-2">
                    <Text className="text-foreground dark:text-foreground-dark text-sm">
                      {new Date(e.startedAt).toLocaleDateString(language, { day: 'numeric', month: 'short' })} · {formatDuration(e.minutes ?? 0)}
                    </Text>
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                      {e.eventTitle ? `${e.eventTitle} · ` : ''}
                      {t(`time.status.${e.status}`)}
                    </Text>
                  </View>
                  {canDeleteEntry(e) ? <LinkButton label={t('ui.delete')} danger disabled={!!busy} onPress={() => void run(e.id, () => time.removeEntry(e.id))} /> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </FormSheet>
  );
}
