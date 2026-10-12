import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { LIVE_MEMBER_STATUSES, type ClubMember } from '@/hooks/useClubMembers';
import type { MeetingInvitee } from '@/hooks/useMeetingDetail';

interface Props {
  invitees: MeetingInvitee[];
  /** Whole club directory; only members with an account (`memberId`) can be invited. */
  directory: ClubMember[];
  nameFor: (memberId: string) => string;
  onAdd: (memberId: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
}

const SUGGESTION_LIMIT = 8;
// Only members still in the club are suggested (LIVE_MEMBER_STATUSES): inviting people who left makes no sense.

/** Board section "Eingeladene": see who was invited and how they answered, invite more, remove (`meetings:write`). */
export default function MeetingInvitees({ invitees, directory, nameFor, onAdd, onRemove }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const invited = new Set(invitees.map((i) => i.memberId));
    return directory.filter((m) => m.memberId && !invited.has(m.memberId) && LIVE_MEMBER_STATUSES.includes(m.effectiveStatus));
  }, [directory, invitees]);

  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? candidates : candidates.slice(0, SUGGESTION_LIMIT);

  const run = async (memberId: string, action: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(memberId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('treffen.invitees.title')}</Text>

      {invitees.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('treffen.invitees.empty')}</Text>
      ) : (
        invitees.map((inv) => (
          <View key={inv.id} className="flex-row items-center justify-between py-1.5" style={{ gap: 8, minHeight: 44 }}>
            <View className="flex-1">
              <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">{nameFor(inv.memberId)}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t(`treffen.rsvp.response.${inv.response}`)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => void run(inv.memberId, () => onRemove(inv.memberId))}
              disabled={busyId !== null}
              className="px-2 justify-center"
              style={{ minHeight: 44 }}
              accessibilityRole="button"
              accessibilityLabel={t('treffen.invitees.remove-for', { name: nameFor(inv.memberId) })}
            >
              {busyId === inv.memberId ? (
                <ActivityIndicator color={themeColors.destructive} size="small" />
              ) : (
                <Text className="text-destructive text-xs font-semibold">{t('treffen.invitees.remove')}</Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}

      {error ? (
        <Text className="text-destructive text-sm mt-2" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {!adding ? (
        <TouchableOpacity
          className="self-start justify-center mt-2"
          style={{ minHeight: 44 }}
          onPress={() => setAdding(true)}
          accessibilityRole="button"
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('treffen.invitees.add')}</Text>
        </TouchableOpacity>
      ) : (
        <View className="mt-3 pt-3 border-t border-border dark:border-border-dark">
          {candidates.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('treffen.invitees.none-left')}</Text>
          ) : (
            visible.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => void run(m.memberId!, () => onAdd(m.memberId!))}
                disabled={busyId !== null}
                className="flex-row items-center justify-between"
                style={{ minHeight: 44 }}
                accessibilityRole="button"
                accessibilityLabel={t('treffen.invitees.invite-for', { name: m.name ?? '—' })}
              >
                <Text className="text-foreground dark:text-foreground-dark text-sm">{m.name ?? '—'}</Text>
                {busyId === m.memberId ? (
                  <ActivityIndicator color={themeColors.primary} size="small" />
                ) : (
                  <Text className="text-primary dark:text-primary-dark text-xs font-bold">{t('treffen.invitees.invite')}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
          {!showAll && candidates.length > SUGGESTION_LIMIT ? (
            <TouchableOpacity className="justify-center" style={{ minHeight: 44 }} onPress={() => setShowAll(true)} accessibilityRole="button">
              <Text className="text-primary dark:text-primary-dark text-xs font-semibold">
                {t('treffen.invitees.show-all', { count: candidates.length })}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity className="self-start justify-center" style={{ minHeight: 44 }} onPress={() => setAdding(false)} accessibilityRole="button">
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{t('treffen.invitees.done')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
