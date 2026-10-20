import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import DateTimeField from '@/components/ui/DateTimeField';
import NotifySwitch from '@/components/ui/NotifySwitch';
import { withNotify } from '@/lib/notifyOptions';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { MEETING_STATUSES, type Meeting, type MeetingPatch, type MeetingStatus } from '@/hooks/useMeetings';

interface Props {
  meeting: Meeting;
  onUpdate: (patch: MeetingPatch) => Promise<unknown>;
  /** `notify` false = do not tell the invitees (backend `?notify=false`). */
  onDelete: (notify: boolean) => Promise<void>;
}

/** Board controls for one meeting (`meetings:write`): change the status, set/clear the date, delete. */
export default function MeetingManageSection({ meeting, onUpdate, onDelete }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [date, setDate] = useState<Date | null>(meeting.scheduledAt ? new Date(meeting.scheduledAt) : null);
  const [busy, setBusy] = useState<'status' | 'date' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Applies to date change, status change and delete of this meeting; default on like the website.
  const [notify, setNotify] = useState(true);

  const dateDirty = (date ? date.toISOString() : null) !== (meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : null);

  const run = async (kind: 'status' | 'date' | 'delete', action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = (status: MeetingStatus) => {
    if (status === meeting.status) return;
    void run('status', () => onUpdate(withNotify({ status }, notify)));
  };

  const confirmDelete = () => {
    Alert.alert(t('treffen.delete.title'), t('treffen.delete.message', { title: meeting.title }), [
      { text: t('treffen.cancel'), style: 'cancel' },
      { text: t('treffen.delete.confirm'), style: 'destructive', onPress: () => void run('delete', () => onDelete(notify)) },
    ]);
  };

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('treffen.manage.title')}</Text>

      <NotifySwitch label={t('treffen.notify')} hint={t('treffen.notify.hint-manage')} value={notify} onChange={setNotify} disabled={busy !== null} />

      <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">{t('treffen.manage.status')}</Text>
      <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
        {MEETING_STATUSES.map((s) => {
          const selected = s === meeting.status;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => changeStatus(s)}
              disabled={busy !== null}
              className={`px-3 rounded-full justify-center ${selected ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'} ${busy === 'status' && !selected ? 'opacity-50' : ''}`}
              style={{ minHeight: 44 }}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: busy !== null }}
              accessibilityLabel={t(`treffen.status.${s}`)}
            >
              <Text
                className={`text-xs font-semibold ${selected ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
              >
                {t(`treffen.status.${s}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">{t('treffen.scheduled-at')}</Text>
      <DateTimeField value={date} onChange={setDate} placeholder={t('treffen.scheduled-at.placeholder')} clearable />
      {dateDirty ? (
        <TouchableOpacity
          className={`bg-primary dark:bg-primary-dark rounded-lg items-center justify-center mt-2 ${busy ? 'opacity-70' : ''}`}
          style={{ minHeight: 44 }}
          onPress={() => void run('date', () => onUpdate(withNotify({ scheduledAt: date ? date.toISOString() : null }, notify)))}
          disabled={busy !== null}
          accessibilityRole="button"
        >
          {busy === 'date' ? (
            <ActivityIndicator color={themeColors.primaryForeground} size="small" />
          ) : (
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('treffen.manage.save-date')}</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {error ? (
        <Text className="text-destructive text-sm mt-3" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        className="self-start justify-center mt-4"
        style={{ minHeight: 44 }}
        onPress={confirmDelete}
        disabled={busy !== null}
        accessibilityRole="button"
      >
        {busy === 'delete' ? (
          <ActivityIndicator color={themeColors.destructive} size="small" />
        ) : (
          <Text className="text-destructive text-sm font-semibold">{t('treffen.delete')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
