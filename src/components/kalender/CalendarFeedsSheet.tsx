import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { backendUrl } from '@/auth/auth-client';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { absoluteFeedUrl, FEED_LABEL_MAX, webcalFeedUrl, type CalendarFeed, type NewCalendarFeed } from '@/lib/calendarFeeds';
import { useCalendarFeeds } from '@/hooks/useCalendarFeeds';
import type { Calendar } from '@/hooks/useCalendars';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import { ColorChip } from './ColorChip';

interface Props {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  calendars: Calendar[];
}

function ActionButton({ label, onPress, disabled, destructive }: { label: string; onPress: () => void; disabled?: boolean; destructive?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`justify-center px-3 ${disabled ? 'opacity-50' : ''}`}
      style={{ minHeight: 44 }}
    >
      <Text className={`text-sm font-semibold ${destructive ? 'text-destructive' : 'text-primary dark:text-primary-dark'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

/** The one-time secret link after create / rotate: add to the phone's calendar app or share it. */
function NewLinkCard({ link, onDone }: { link: NewCalendarFeed; onDone: () => void }) {
  const { t } = useLanguage();
  const [message, setMessage] = useState<string | null>(null);
  const url = absoluteFeedUrl(link.url, backendUrl);
  const webcal = webcalFeedUrl(link.webcalUrl, url);

  const addToCalendar = async () => {
    setMessage(null);
    try {
      await Linking.openURL(webcal);
    } catch {
      setMessage(t('feeds.no-calendar-app'));
    }
  };
  const share = async () => {
    setMessage(null);
    try {
      await Share.share({ message: url });
    } catch {
      setMessage(t('feeds.share-failed'));
    }
  };

  return (
    <View className="border border-primary dark:border-primary-dark rounded-xl p-3 mb-4" accessibilityLiveRegion="polite">
      <Text className="text-foreground dark:text-foreground-dark text-sm font-bold mb-1">{t('feeds.new.title')}</Text>
      <Text className="text-destructive text-xs mb-2">{t('feeds.warning')}</Text>
      <Text selectable className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">
        {url}
      </Text>
      <View className="flex-row flex-wrap">
        <ActionButton label={t('feeds.add-to-calendar')} onPress={() => void addToCalendar()} />
        <ActionButton label={t('feeds.share')} onPress={() => void share()} />
        <ActionButton label={t('ui.done')} onPress={onDone} />
      </View>
      {message ? <Text className="text-destructive text-xs mt-1">{message}</Text> : null}
    </View>
  );
}

/** Subscribe to the club calendar in the phone's own calendar app via a revocable secret link. */
export default function CalendarFeedsSheet({ visible, onClose, clubId, calendars }: Props) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const { feeds, loading, error, refetch, createFeed, revokeFeed, rotateFeed } = useCalendarFeeds(clubId, visible);

  const [label, setLabel] = useState('');
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [fresh, setFresh] = useState<NewCalendarFeed | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // The secret link must not outlive the open sheet.
  useEffect(() => {
    if (visible) return;
    setFresh(null);
    setConfirmRevoke(null);
    setProblem(null);
    setLabel('');
    setCalendarId(null);
  }, [visible]);

  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    setProblem(null);
    try {
      await action();
    } catch (err) {
      setProblem(err instanceof ApiError && err.status === 409 ? t('feeds.limit') : apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const create = () =>
    run('create', async () => {
      setFresh(await createFeed(calendarId, label));
      setLabel('');
    });
  const rotate = (feed: CalendarFeed) =>
    run(feed.id, async () => {
      setFresh(await rotateFeed(feed.id));
    });
  const revoke = (feed: CalendarFeed) =>
    run(feed.id, async () => {
      await revokeFeed(feed.id);
      setConfirmRevoke(null);
      setFresh((current) => (current?.id === feed.id ? null : current));
    });

  return (
    <FormSheet visible={visible} title={t('feeds.title')} onClose={onClose} cancelLabel={t('ui.done')} error={problem}>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('feeds.intro')}</Text>

      {fresh ? <NewLinkCard link={fresh} onDone={() => setFresh(null)} /> : null}

      <Field label={t('feeds.create.calendar')}>
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          <ColorChip label={t('feeds.all-calendars')} active={calendarId === null} onPress={() => setCalendarId(null)} disabled={!!busy} />
          {calendars.map((c) => (
            <ColorChip key={c.id} label={c.name} active={calendarId === c.id} onPress={() => setCalendarId(c.id)} disabled={!!busy} />
          ))}
        </View>
      </Field>
      <Field label={t('feeds.create.label')}>
        <TextInput
          className={inputClassName}
          value={label}
          onChangeText={setLabel}
          maxLength={FEED_LABEL_MAX}
          placeholder={t('feeds.create.label-placeholder')}
          placeholderTextColor={themeColors.mutedForeground}
        />
      </Field>
      <TouchableOpacity
        onPress={() => void create()}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!busy, busy: busy === 'create' }}
        className={`bg-primary dark:bg-primary-dark rounded-xl items-center justify-center mb-4 ${busy ? 'opacity-60' : ''}`}
        style={{ minHeight: 44 }}
      >
        {busy === 'create' ? (
          <ActivityIndicator color={themeColors.primaryForeground} size="small" />
        ) : (
          <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('feeds.create')}</Text>
        )}
      </TouchableOpacity>

      <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mb-2">{t('feeds.list.title')}</Text>
      {loading && feeds.length === 0 ? (
        <ActivityIndicator color={themeColors.primary} />
      ) : error && feeds.length === 0 ? (
        <View>
          <Text className="text-destructive text-sm mb-1">{t('feeds.list.error')}</Text>
          <ActionButton label={t('connection.retry')} onPress={() => void refetch()} />
        </View>
      ) : feeds.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('feeds.list.empty')}</Text>
      ) : (
        feeds.map((feed) => (
          <View key={feed.id} className="border border-border dark:border-border-dark rounded-xl p-3 mb-2">
            <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{feed.label || t('feeds.unnamed')}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{feed.calendarName ?? t('feeds.all-calendars')}</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
              {feed.lastUsedAt
                ? t('feeds.last-used', { date: new Date(feed.lastUsedAt).toLocaleDateString(language) })
                : t('feeds.never-used')}
            </Text>
            {confirmRevoke === feed.id ? (
              <View className="mt-1">
                <Text className="text-foreground dark:text-foreground-dark text-xs mb-1">{t('feeds.revoke.confirm')}</Text>
                <View className="flex-row">
                  <ActionButton label={t('feeds.revoke')} destructive disabled={!!busy} onPress={() => void revoke(feed)} />
                  <ActionButton label={t('ui.cancel')} disabled={!!busy} onPress={() => setConfirmRevoke(null)} />
                </View>
              </View>
            ) : (
              <View className="flex-row mt-1">
                <ActionButton label={t('feeds.rotate')} disabled={!!busy} onPress={() => void rotate(feed)} />
                <ActionButton label={t('feeds.revoke')} destructive disabled={!!busy} onPress={() => setConfirmRevoke(feed.id)} />
              </View>
            )}
          </View>
        ))
      )}
    </FormSheet>
  );
}
