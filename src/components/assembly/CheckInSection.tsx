import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useCheckIn } from '@/hooks/useAssembly';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { buildCheckInRows } from '@/lib/assembly';
import { useThemeColors } from '@/theme/colors';
import { Badge, Body, Button, Card, ErrorRetry, Loading } from './ui';

/** Check-in for the secretary (Wave 11 M3): search, check in / leave / return, live quorum. Members without an account are listed too. */
export default function CheckInSection({ clubId, meetingId }: { clubId: string; meetingId: string }) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const c = useCheckIn(clubId, meetingId, true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => buildCheckInRows(c.invitees, c.attendance, query), [c.invitees, c.attendance, query]);

  const toggle = async (id: string, present: boolean) => {
    setError(null);
    try {
      await c.setPresent(id, present);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    }
  };

  return (
    <Card title={t('assembly.checkin.title')}>
      {c.quorum ? (
        <View className="mb-2">
          <Badge symbol={c.quorum.result === 'beschlussfaehig' ? '✓' : '!'} label={t(`assembly.quorum.${c.quorum.result}`)} />
          <Body muted>{t('assembly.quorum.counts', { present: c.quorum.represented, eligible: c.quorum.eligibleTotal })}</Body>
        </View>
      ) : null}
      <TextInput
        accessibilityLabel={t('assembly.checkin.search')}
        placeholder={t('assembly.checkin.search')}
        placeholderTextColor={colors.mutedForeground}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3 min-h-[48px]"
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm mb-2">
          {error}
        </Text>
      ) : null}
      {c.loading && rows.length === 0 ? <Loading /> : null}
      {c.error && rows.length === 0 ? <ErrorRetry message={t('assembly.checkin.error')} onRetry={() => void c.reload()} /> : null}
      {!c.loading && !c.error && rows.length === 0 ? <Body muted>{t('assembly.checkin.empty')}</Body> : null}
      {rows.map((r) => (
        <View key={r.clubMemberId} className="mb-2 border-b border-border dark:border-border-dark pb-2">
          <Text className="text-foreground dark:text-foreground-dark font-semibold text-base">{r.displayName || t('assembly.unknown-person')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-1">
            {`${r.state === 'present' ? '✓' : r.state === 'left' ? '↩' : '○'} ${t(`assembly.checkin.state.${r.state}`)}${r.proxyCount > 0 ? ` · ${t('assembly.checkin.proxies', { count: r.proxyCount })}` : ''}`}
          </Text>
          <Button
            secondary={r.state === 'present'}
            label={r.state === 'present' ? t('assembly.checkin.leave', { name: r.displayName }) : r.state === 'left' ? t('assembly.checkin.return', { name: r.displayName }) : t('assembly.checkin.in', { name: r.displayName })}
            busy={c.pending === r.clubMemberId}
            disabled={!!c.pending}
            onPress={() => void toggle(r.clubMemberId, r.state !== 'present')}
          />
        </View>
      ))}
    </Card>
  );
}
