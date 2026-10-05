import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import DateTimeField from '@/components/ui/DateTimeField';
import { ApiError } from '@/lib/api';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useClubMembers } from '@/hooks/useClubMembers';
import { useMeetings, type Meeting, type MeetingStatus } from '@/hooks/useMeetings';
import { useMeetingDetail, type AttendanceEntry, type OverlapCandidate } from '@/hooks/useMeetingDetail';

interface Props {
  clubId: string;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{title}</Text>
      {children}
    </View>
  );
}

function StatusBadge({ status }: { status: MeetingStatus }) {
  const { t } = useLanguage();
  return (
    <View className="bg-primary/10 dark:bg-primary-dark/10 px-2.5 py-1 rounded-full self-start">
      <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t(`treffen.status.${status}`)}</Text>
    </View>
  );
}

function MeetingListRow({ meeting, onPress }: { meeting: Meeting; onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3"
    >
      <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mb-1">{meeting.title}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">{meeting.type}</Text>
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : t('treffen.scheduled-at.pending')}
        </Text>
        <StatusBadge status={meeting.status} />
      </View>
    </TouchableOpacity>
  );
}

function MeetingList({ clubId, onSelect }: { clubId: string; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { meetings, loading, createMeeting } = useMeetings(clubId);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !type.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createMeeting({ title: title.trim(), type: type.trim(), scheduledAt: scheduledAt?.toISOString() });
      setTitle('');
      setType('');
      setScheduledAt(null);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      {meetings.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{t('treffen.list.empty')}</Text>
      ) : (
        meetings.map((m) => <MeetingListRow key={m.id} meeting={m} onPress={() => onSelect(m.id)} />)
      )}

      {showCreate ? (
        <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4">
          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('treffen.title')}
          </Text>
          <TextInput
            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
            placeholderTextColor={themeColors.mutedForeground}
            value={title}
            onChangeText={setTitle}
          />
          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('treffen.type')}
          </Text>
          <TextInput
            className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
            placeholder={t('treffen.type.placeholder')}
            placeholderTextColor={themeColors.mutedForeground}
            value={type}
            onChangeText={setType}
          />
          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('treffen.scheduled-at')}
          </Text>
          <View className="mb-3">
            <DateTimeField value={scheduledAt} onChange={setScheduledAt} placeholder={t('treffen.scheduled-at.placeholder')} clearable />
          </View>
          {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-3 items-center ${saving ? 'opacity-70' : ''}`}
            onPress={() => void handleCreate()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('treffen.submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          className="bg-primary dark:bg-primary-dark rounded-lg py-3 items-center self-start px-5"
          onPress={() => setShowCreate(true)}
        >
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('treffen.create')}</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

function AgendaMinutes({ meeting, onSave }: { meeting: Meeting; onSave: (agenda: string, minutes: string) => Promise<void> }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [agenda, setAgenda] = useState(meeting.agenda ?? '');
  const [minutes, setMinutes] = useState(meeting.minutes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSave(agenda, minutes);
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <SectionCard title={t('treffen.agenda')}>
        <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">
          {meeting.agenda || t('treffen.agenda.empty')}
        </Text>
        <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mb-1">{t('treffen.minutes')}</Text>
        <Text className="text-foreground dark:text-foreground-dark text-sm mb-3">{meeting.minutes || t('treffen.minutes.empty')}</Text>
        {saved ? <Text className="text-success dark:text-success-dark text-xs mb-2">{t('treffen.agenda-minutes.saved')}</Text> : null}
        <TouchableOpacity onPress={() => setEditing(true)} className="self-start">
          <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('treffen.agenda-minutes.save')}</Text>
        </TouchableOpacity>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t('treffen.agenda')}>
      <TextInput
        className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
        placeholderTextColor={themeColors.mutedForeground}
        value={agenda}
        onChangeText={setAgenda}
        multiline
        numberOfLines={3}
      />
      <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mb-1">{t('treffen.minutes')}</Text>
      <TextInput
        className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
        placeholderTextColor={themeColors.mutedForeground}
        value={minutes}
        onChangeText={setMinutes}
        multiline
        numberOfLines={3}
      />
      {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}
      <TouchableOpacity
        className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center ${saving ? 'opacity-70' : ''}`}
        onPress={() => void handleSave()}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={themeColors.primaryForeground} size="small" />
        ) : (
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
            {t('treffen.agenda-minutes.save')}
          </Text>
        )}
      </TouchableOpacity>
    </SectionCard>
  );
}

function MeetingDetail({ clubId, meetingId, onBack }: { clubId: string; meetingId: string; onBack: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { membership } = useOwnMembership(clubId);
  const { members } = useClubMembers(clubId);
  const {
    meeting,
    invitees,
    resolutions,
    loading,
    updateMeeting,
    respondToInvite,
    recordAttendance,
    createResolution,
    getOverlap,
  } = useMeetingDetail(clubId, meetingId);

  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [rsvpSaving, setRsvpSaving] = useState(false);

  const [candidateInput, setCandidateInput] = useState<Date | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [overlapResults, setOverlapResults] = useState<OverlapCandidate[] | null>(null);
  const [overlapChecking, setOverlapChecking] = useState(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);

  const [attendance, setAttendance] = useState<Record<string, { present: boolean; hasVotingRight: boolean }>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [resDescription, setResDescription] = useState('');
  const [resFor, setResFor] = useState('0');
  const [resAgainst, setResAgainst] = useState('0');
  const [resAbstain, setResAbstain] = useState('0');
  const [resResult, setResResult] = useState('');
  const [resSaving, setResSaving] = useState(false);
  const [resError, setResError] = useState<string | null>(null);

  const nameFor = (memberId: string) => members.find((m) => m.id === memberId)?.name ?? memberId;

  const ownInvite = membership ? invitees.find((i) => i.memberId === membership.id) : undefined;

  const handleRespond = async (response: 'zugesagt' | 'abgesagt') => {
    setRsvpSaving(true);
    setRsvpError(null);
    try {
      await respondToInvite(response);
    } catch (err) {
      setRsvpError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setRsvpSaving(false);
    }
  };

  const handleAddCandidate = () => {
    if (!candidateInput) return;
    const iso = candidateInput.toISOString();
    setCandidates((prev) => [...prev, iso]);
    setCandidateInput(null);
    setOverlapResults(null);
  };

  const handleCheckOverlap = async () => {
    if (candidates.length === 0) return;
    setOverlapChecking(true);
    setOverlapError(null);
    try {
      const data = await getOverlap(candidates);
      setOverlapResults(data);
    } catch (err) {
      setOverlapError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setOverlapChecking(false);
    }
  };

  const handleSaveAttendance = async () => {
    setAttendanceSaving(true);
    setAttendanceError(null);
    setAttendanceSaved(false);
    try {
      const entries: AttendanceEntry[] = invitees.map((inv) => ({
        memberId: inv.memberId,
        present: attendance[inv.memberId]?.present ?? false,
        hasVotingRight: attendance[inv.memberId]?.hasVotingRight ?? true,
      }));
      await recordAttendance(entries);
      setAttendanceSaved(true);
    } catch (err) {
      setAttendanceError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setAttendanceSaving(false);
    }
  };

  const handleCreateResolution = async () => {
    if (!resDescription.trim() || !resResult.trim() || resSaving) return;
    setResSaving(true);
    setResError(null);
    try {
      await createResolution({
        description: resDescription.trim(),
        votesFor: Number(resFor) || 0,
        votesAgainst: Number(resAgainst) || 0,
        votesAbstain: Number(resAbstain) || 0,
        result: resResult.trim(),
      });
      setResDescription('');
      setResFor('0');
      setResAgainst('0');
      setResAbstain('0');
      setResResult('');
      setShowResolutionForm(false);
    } catch (err) {
      setResError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setResSaving(false);
    }
  };

  if (loading || !meeting) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={onBack} className="mb-3 self-start">
        <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('treffen.back')}</Text>
      </TouchableOpacity>

      <View className="mb-4">
        <Text className="text-xl font-black text-foreground dark:text-foreground-dark mb-1">{meeting.title}</Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{meeting.type}</Text>
          <StatusBadge status={meeting.status} />
        </View>
      </View>

      <AgendaMinutes meeting={meeting} onSave={(agenda, minutes) => updateMeeting({ agenda, minutes }).then(() => undefined)} />

      {ownInvite && (
        <SectionCard title={t('treffen.rsvp.title')}>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">
            {t('treffen.rsvp.current')}: {t(`treffen.rsvp.response.${ownInvite.response}`)}
          </Text>
          {rsvpError ? <Text className="text-destructive text-sm mb-2">{rsvpError}</Text> : null}
          <View className="flex-row" style={{ gap: 10 }}>
            <TouchableOpacity
              className={`bg-primary dark:bg-primary-dark rounded-lg py-2 px-4 ${rsvpSaving ? 'opacity-70' : ''}`}
              onPress={() => void handleRespond('zugesagt')}
              disabled={rsvpSaving}
            >
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
                {t('treffen.rsvp.accept')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`bg-muted dark:bg-muted-dark rounded-lg py-2 px-4 ${rsvpSaving ? 'opacity-70' : ''}`}
              onPress={() => void handleRespond('abgesagt')}
              disabled={rsvpSaving}
            >
              <Text className="text-foreground dark:text-foreground-dark text-xs font-bold">{t('treffen.rsvp.decline')}</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>
      )}

      <SectionCard title={t('treffen.overlap.title')}>
        {candidates.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('treffen.overlap.empty')}</Text>
        ) : (
          candidates.map((c, i) => (
            <Text key={c + i} className="text-foreground dark:text-foreground-dark text-xs mb-1">
              {new Date(c).toLocaleString()}
            </Text>
          ))
        )}
        <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
          <View className="flex-1">
            <DateTimeField value={candidateInput} onChange={setCandidateInput} placeholder={t('treffen.overlap.candidate-placeholder')} />
          </View>
          <TouchableOpacity className="bg-muted dark:bg-muted-dark rounded-lg py-2.5 px-3" onPress={handleAddCandidate}>
            <Text className="text-foreground dark:text-foreground-dark text-xs font-bold">{t('treffen.overlap.add-candidate')}</Text>
          </TouchableOpacity>
        </View>

        {overlapError ? <Text className="text-destructive text-sm mt-2">{overlapError}</Text> : null}

        <TouchableOpacity
          className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center mt-3 ${overlapChecking || candidates.length === 0 ? 'opacity-70' : ''}`}
          onPress={() => void handleCheckOverlap()}
          disabled={overlapChecking || candidates.length === 0}
        >
          {overlapChecking ? (
            <ActivityIndicator color={themeColors.primaryForeground} size="small" />
          ) : (
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
              {t('treffen.overlap.check')}
            </Text>
          )}
        </TouchableOpacity>

        {overlapResults && (
          <View className="mt-3">
            {overlapResults.map((result) => {
              const available = result.availability.filter((a) => a.available).length;
              return (
                <View key={result.candidate} className="py-2 border-t border-border dark:border-border-dark">
                  <Text className="text-foreground dark:text-foreground-dark text-xs font-semibold mb-1">
                    {new Date(result.candidate).toLocaleString()}
                  </Text>
                  <View className="flex-row items-center flex-wrap" style={{ gap: 4 }}>
                    {result.availability.map((a) => (
                      <View
                        key={a.memberId}
                        className={`w-5 h-5 rounded-full items-center justify-center ${a.available ? 'bg-success/20' : 'bg-destructive/20'}`}
                      >
                        {a.available ? (
                          <Check size={12} color={themeColors.success} />
                        ) : (
                          <X size={12} color={themeColors.destructive} />
                        )}
                      </View>
                    ))}
                    <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs ml-1">
                      {t('treffen.overlap.count', { available, total: result.availability.length })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard title={t('treffen.attendance.title')}>
        {invitees.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('treffen.attendance.empty')}</Text>
        ) : (
          invitees.map((inv, i) => {
            const row = attendance[inv.memberId] ?? { present: false, hasVotingRight: true };
            return (
              <View
                key={inv.id}
                className={`py-2.5 ${i === invitees.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}
              >
                <Text className="text-foreground dark:text-foreground-dark text-sm font-medium mb-2">{nameFor(inv.memberId)}</Text>
                <View className="flex-row items-center" style={{ gap: 16 }}>
                  <TouchableOpacity
                    className="flex-row items-center"
                    style={{ gap: 6 }}
                    onPress={() =>
                      setAttendance((prev) => ({
                        ...prev,
                        [inv.memberId]: { ...row, present: !row.present },
                      }))
                    }
                  >
                    <View
                      className={`w-4 h-4 rounded ${row.present ? 'bg-primary dark:bg-primary-dark' : 'border border-border dark:border-border-dark'}`}
                    />
                    <Text className="text-xs text-foreground dark:text-foreground-dark">{t('treffen.attendance.present')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center"
                    style={{ gap: 6 }}
                    onPress={() =>
                      setAttendance((prev) => ({
                        ...prev,
                        [inv.memberId]: { ...row, hasVotingRight: !row.hasVotingRight },
                      }))
                    }
                  >
                    <View
                      className={`w-4 h-4 rounded ${row.hasVotingRight ? 'bg-primary dark:bg-primary-dark' : 'border border-border dark:border-border-dark'}`}
                    />
                    <Text className="text-xs text-foreground dark:text-foreground-dark">{t('treffen.attendance.voting-right')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {attendanceError ? <Text className="text-destructive text-sm mt-3">{attendanceError}</Text> : null}
        {attendanceSaved && !attendanceError ? (
          <Text className="text-success dark:text-success-dark text-xs mt-3">{t('treffen.attendance.saved')}</Text>
        ) : null}

        {invitees.length > 0 && (
          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center mt-3 ${attendanceSaving ? 'opacity-70' : ''}`}
            onPress={() => void handleSaveAttendance()}
            disabled={attendanceSaving}
          >
            {attendanceSaving ? (
              <ActivityIndicator color={themeColors.primaryForeground} size="small" />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
                {t('treffen.attendance.save')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </SectionCard>

      <SectionCard title={t('treffen.resolutions.title')}>
        {resolutions.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('treffen.resolutions.empty')}</Text>
        ) : (
          resolutions.map((r, i) => (
            <View
              key={r.id}
              className={`py-2.5 ${i === resolutions.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}
            >
              <Text className="text-foreground dark:text-foreground-dark text-sm font-medium mb-1">{r.description}</Text>
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                  {r.votesFor}/{r.votesAgainst}/{r.votesAbstain}
                </Text>
                <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{r.result}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {showResolutionForm ? (
          <View className="mt-3 pt-3 border-t border-border dark:border-border-dark">
            <TextInput
              className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
              placeholder={t('treffen.resolutions.description')}
              placeholderTextColor={themeColors.mutedForeground}
              value={resDescription}
              onChangeText={setResDescription}
            />
            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">
                  {t('treffen.resolutions.votes-for')}
                </Text>
                <TextInput
                  className="bg-muted dark:bg-muted-dark rounded-lg p-2.5 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark"
                  keyboardType="number-pad"
                  value={resFor}
                  onChangeText={setResFor}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">
                  {t('treffen.resolutions.votes-against')}
                </Text>
                <TextInput
                  className="bg-muted dark:bg-muted-dark rounded-lg p-2.5 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark"
                  keyboardType="number-pad"
                  value={resAgainst}
                  onChangeText={setResAgainst}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">
                  {t('treffen.resolutions.votes-abstain')}
                </Text>
                <TextInput
                  className="bg-muted dark:bg-muted-dark rounded-lg p-2.5 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark"
                  keyboardType="number-pad"
                  value={resAbstain}
                  onChangeText={setResAbstain}
                />
              </View>
            </View>
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1 mt-3">
              {t('treffen.resolutions.result')}
            </Text>
            <TextInput
              className="bg-muted dark:bg-muted-dark rounded-lg p-3 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-3"
              placeholder={t('treffen.resolutions.result.placeholder')}
              placeholderTextColor={themeColors.mutedForeground}
              value={resResult}
              onChangeText={setResResult}
            />
            {resError ? <Text className="text-destructive text-sm mb-3">{resError}</Text> : null}
            <TouchableOpacity
              className={`bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center ${resSaving ? 'opacity-70' : ''}`}
              onPress={() => void handleCreateResolution()}
              disabled={resSaving}
            >
              {resSaving ? (
                <ActivityIndicator color={themeColors.primaryForeground} size="small" />
              ) : (
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
                  {t('treffen.resolutions.submit')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity className="self-start mt-2" onPress={() => setShowResolutionForm(true)}>
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('treffen.resolutions.create')}</Text>
          </TouchableOpacity>
        )}
      </SectionCard>
    </>
  );
}

export default function TreffenTab({ clubId }: Props) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  return selectedMeetingId ? (
    <MeetingDetail clubId={clubId} meetingId={selectedMeetingId} onBack={() => setSelectedMeetingId(null)} />
  ) : (
    <MeetingList clubId={clubId} onSelect={setSelectedMeetingId} />
  );
}
