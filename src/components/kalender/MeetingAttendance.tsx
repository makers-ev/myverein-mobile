import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import {
  applyAttendanceEdit,
  buildAttendanceEntries,
  effectiveAttendance,
  type AttendanceEdit,
  type AttendanceEdits,
} from '@/lib/meetingAttendance';
import type { ClubMember } from '@/hooks/useClubMembers';
import type { AttendanceEntry, AttendanceRow, MeetingInvitee } from '@/hooks/useMeetingDetail';

interface Props {
  invitees: MeetingInvitee[];
  /** Stored rows (`GET /meetings/:id/attendance`): the form is pre-filled from them. */
  attendance: AttendanceRow[];
  directory: ClubMember[];
  nameFor: (memberId: string) => string;
  onSave: (entries: AttendanceEntry[]) => Promise<void>;
}

function Check({ checked, label, onPress, disabled }: { checked: boolean; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      className="flex-row items-center"
      style={{ gap: 6, minHeight: 44 }}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
    >
      <View className={`w-5 h-5 rounded ${checked ? 'bg-primary dark:bg-primary-dark' : 'border border-border dark:border-border-dark'}`} />
      <Text className="text-xs text-foreground dark:text-foreground-dark">{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Attendance, voting right and proxy (Vollmacht) per invitee. Pre-filled from the stored rows; only edited fields
 * of edited members are sent (partial update, B17), so saving again never resets anything.
 */
export default function MeetingAttendance({ invitees, attendance, directory, nameFor, onSave }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [edits, setEdits] = useState<AttendanceEdits>({});
  const [proxyFor, setProxyFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invitees plus anyone who has a stored row without being invited (e.g. removed from the invitees afterwards).
  const memberIds = [...new Set([...invitees.map((i) => i.memberId), ...attendance.map((a) => a.memberId)])];
  const entries = buildAttendanceEntries(edits);
  const dirty = entries.length > 0;

  const edit = <K extends keyof AttendanceEdit>(memberId: string, field: K, value: NonNullable<AttendanceEdit[K]> | null) => {
    setEdits((prev) => applyAttendanceEdit(attendance, prev, memberId, field, value));
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSave(entries);
      setEdits({});
      setProxyFor(null);
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const proxyCandidates = (memberId: string) => directory.filter((m) => m.memberId && m.memberId !== memberId);

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('treffen.attendance.title')}</Text>
      {memberIds.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('treffen.attendance.empty')}</Text>
      ) : (
        memberIds.map((memberId, i) => {
          const row = effectiveAttendance(attendance, edits, memberId);
          const proxyName = row.proxyForMemberId ? nameFor(row.proxyForMemberId) : null;
          const open = proxyFor === memberId;
          return (
            <View key={memberId} className={`py-2 ${i === memberIds.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}>
              <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">{nameFor(memberId)}</Text>
              <View className="flex-row flex-wrap items-center" style={{ columnGap: 16 }}>
                <Check checked={row.present} label={t('treffen.attendance.present')} disabled={saving} onPress={() => edit(memberId, 'present', !row.present)} />
                <Check
                  checked={row.hasVotingRight}
                  label={t('treffen.attendance.voting-right')}
                  disabled={saving}
                  onPress={() => edit(memberId, 'hasVotingRight', !row.hasVotingRight)}
                />
              </View>
              <TouchableOpacity
                className="self-start justify-center"
                style={{ minHeight: 44 }}
                onPress={() => setProxyFor(open ? null : memberId)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Text className="text-primary dark:text-primary-dark text-xs font-semibold">
                  {proxyName ? t('treffen.attendance.proxy-for', { name: proxyName }) : t('treffen.attendance.proxy-none')}
                </Text>
              </TouchableOpacity>
              {open ? (
                <View className="rounded-lg border border-border dark:border-border-dark bg-muted dark:bg-muted-dark p-2 mb-1">
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-1">{t('treffen.attendance.proxy-hint')}</Text>
                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                      style={{ minHeight: 44 }}
                      className="justify-center"
                      onPress={() => {
                        edit(memberId, 'proxyForMemberId', null);
                        setProxyFor(null);
                      }}
                      accessibilityRole="button"
                    >
                      <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('treffen.attendance.proxy-clear')}</Text>
                    </TouchableOpacity>
                    {proxyCandidates(memberId).map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={{ minHeight: 44 }}
                        className="justify-center"
                        onPress={() => {
                          edit(memberId, 'proxyForMemberId', m.memberId!);
                          setProxyFor(null);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: row.proxyForMemberId === m.memberId }}
                      >
                        <Text
                          className={`text-sm ${row.proxyForMemberId === m.memberId ? 'text-primary dark:text-primary-dark font-bold' : 'text-foreground dark:text-foreground-dark'}`}
                        >
                          {m.name ?? '—'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {error ? (
        <Text className="text-destructive text-sm mt-3" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {saved && !error && !dirty ? <Text className="text-success dark:text-success-dark text-xs mt-3">{t('treffen.attendance.saved')}</Text> : null}

      {memberIds.length > 0 ? (
        <TouchableOpacity
          className={`bg-primary dark:bg-primary-dark rounded-lg items-center justify-center mt-3 ${saving || !dirty ? 'opacity-50' : ''}`}
          style={{ minHeight: 44 }}
          onPress={() => void handleSave()}
          disabled={saving || !dirty}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !dirty, busy: saving }}
        >
          {saving ? (
            <ActivityIndicator color={themeColors.primaryForeground} size="small" />
          ) : (
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">{t('treffen.attendance.save')}</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
