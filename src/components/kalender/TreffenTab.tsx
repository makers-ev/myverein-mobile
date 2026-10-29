import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import DateTimeField from '@/components/ui/DateTimeField';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useClubMemberDirectory } from '@/hooks/useClubMembers';
import { MEETING_TYPES, useMeetings, type Meeting, type MeetingStatus, type MeetingType } from '@/hooks/useMeetings';
import { useMeetingDetail, type OverlapCandidate } from '@/hooks/useMeetingDetail';
import ResolutionCorrection from './ResolutionCorrection';
import MeetingManageSection from './MeetingManageSection';
import MeetingInvitees from './MeetingInvitees';
import MeetingAttendance from './MeetingAttendance';

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

/** Localised meeting type; unknown legacy values are shown as they are. */
function useTypeLabel() {
  const { t } = useLanguage();
  return (type: string) => ((MEETING_TYPES as readonly string[]).includes(type) ? t(`treffen.type.${type}`) : type);
}

function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <View className="py-6">
      <Text className="text-destructive text-sm mb-3" accessibilityRole="alert">
        {message}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        className="self-start px-5 justify-center rounded-lg bg-primary dark:bg-primary-dark"
        style={{ minHeight: 44 }}
        accessibilityRole="button"
      >
        <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('verein.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function MeetingListRow({ meeting, onPress }: { meeting: Meeting; onPress: () => void }) {
  const { t } = useLanguage();
  const typeLabel = useTypeLabel();
  return (
    <TouchableOpacity accessibilityRole="button"
      onPress={onPress}
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3"
    >
      <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mb-1">{meeting.title}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">{typeLabel(meeting.type)}</Text>
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
          {meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : t('treffen.scheduled-at.pending')}
        </Text>
        <StatusBadge status={meeting.status} />
      </View>
    </TouchableOpacity>
  );
}

function MeetingList({ clubId, canWrite, onSelect }: { clubId: string; canWrite: boolean; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { meetings, loading, error: loadError, refetch, createMeeting } = useMeetings(clubId);
  const typeLabel = useTypeLabel();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MeetingType | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !type || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createMeeting({ title: title.trim(), type, scheduledAt: scheduledAt?.toISOString() });
      setTitle('');
      setType(null);
      setScheduledAt(null);
      setShowCreate(false);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  if (loading && meetings.length === 0) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  if (loadError && meetings.length === 0) return <ErrorRetry message={t('treffen.list.error')} onRetry={() => void refetch()} />;

  return (
    <>
      {meetings.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-4">{t('treffen.list.empty')}</Text>
      ) : (
        meetings.map((m) => <MeetingListRow key={m.id} meeting={m} onPress={() => onSelect(m.id)} />)
      )}

      {!canWrite ? null : showCreate ? (
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
          <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
            {MEETING_TYPES.map((value) => {
              const selected = type === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setType(value)}
                  className={`px-3 rounded-full justify-center ${selected ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark border border-border dark:border-border-dark'}`}
                  style={{ minHeight: 44 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={typeLabel(value)}
                >
                  <Text
                    className={`text-xs font-semibold ${selected ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
                  >
                    {typeLabel(value)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text className="text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">
            {t('treffen.scheduled-at')}
          </Text>
          <View className="mb-3">
            <DateTimeField value={scheduledAt} onChange={setScheduledAt} placeholder={t('treffen.scheduled-at.placeholder')} clearable />
          </View>
          {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity accessibilityRole="button"
            className={`bg-primary dark:bg-primary-dark rounded-lg py-3 items-center ${saving || !title.trim() || !type ? 'opacity-50' : ''}`}
            onPress={() => void handleCreate()}
            disabled={saving || !title.trim() || !type}
          >
            {saving ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('treffen.submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity accessibilityRole="button"
          className="bg-primary dark:bg-primary-dark rounded-lg py-3 items-center self-start px-5"
          onPress={() => setShowCreate(true)}
        >
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('treffen.create')}</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

function AgendaMinutes({
  meeting,
  canWrite,
  onSave,
}: {
  meeting: Meeting;
  canWrite: boolean;
  onSave: (agenda: string, minutes: string) => Promise<void>;
}) {
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
      setError(apiErrorMessage(err, t));
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
        {canWrite ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setEditing(true)} className="self-start">
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('treffen.agenda-minutes.save')}</Text>
          </TouchableOpacity>
        ) : null}
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
      <TouchableOpacity accessibilityRole="button"
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
  const { membership, can } = useOwnMembership(clubId);
  // Everything that writes meeting data needs meetings:write (backend 403s otherwise); RSVP stays self-service.
  const canWrite = can('meetings:write');
  const { members } = useClubMemberDirectory(clubId);
  const typeLabel = useTypeLabel();
  const {
    meeting,
    invitees,
    resolutions,
    attendance,
    loading,
    error: loadError,
    refetch,
    updateMeeting,
    deleteMeeting,
    addInvitee,
    removeInvitee,
    respondToInvite,
    recordAttendance,
    createResolution,
    correctResolution,
    getOverlap,
  } = useMeetingDetail(clubId, meetingId);

  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [rsvpSaving, setRsvpSaving] = useState(false);

  const [candidateInput, setCandidateInput] = useState<Date | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [overlapResults, setOverlapResults] = useState<OverlapCandidate[] | null>(null);
  const [overlapChecking, setOverlapChecking] = useState(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [resDescription, setResDescription] = useState('');
  const [resFor, setResFor] = useState('0');
  const [resAgainst, setResAgainst] = useState('0');
  const [resAbstain, setResAbstain] = useState('0');
  const [resResult, setResResult] = useState('');
  const [resSaving, setResSaving] = useState(false);
  const [resError, setResError] = useState<string | null>(null);

  const nameFor = (memberId: string) => members.find((m) => m.memberId === memberId)?.name ?? t('verein.members.unknown');

  const ownInvite = membership ? invitees.find((i) => i.memberId === membership.memberId) : undefined;

  const handleRespond = async (response: 'zugesagt' | 'abgesagt') => {
    setRsvpSaving(true);
    setRsvpError(null);
    try {
      await respondToInvite(response);
    } catch (err) {
      setRsvpError(apiErrorMessage(err, t));
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
      setOverlapError(apiErrorMessage(err, t));
    } finally {
      setOverlapChecking(false);
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
      setResError(apiErrorMessage(err, t));
    } finally {
      setResSaving(false);
    }
  };

  if (!meeting) {
    return (
      <>
        <TouchableOpacity onPress={onBack} className="mb-3 self-start justify-center" style={{ minHeight: 44 }} accessibilityRole="button">
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('treffen.back')}</Text>
        </TouchableOpacity>
        {loadError ? (
          <ErrorRetry message={t('treffen.detail.error')} onRetry={() => void refetch()} />
        ) : (
          <View className="py-12 items-center" accessibilityLabel={loading ? t('treffen.detail.loading') : undefined}>
            <ActivityIndicator color={themeColors.primary} />
          </View>
        )}
      </>
    );
  }

  return (
    <>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} className="mb-3 self-start">
        <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('treffen.back')}</Text>
      </TouchableOpacity>

      <View className="mb-4">
        <Text className="text-xl font-black text-foreground dark:text-foreground-dark mb-1">{meeting.title}</Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{typeLabel(meeting.type)}</Text>
          <StatusBadge status={meeting.status} />
        </View>
      </View>

      {canWrite && (
        <MeetingManageSection
          // Re-sync the date field when the server value changes (e.g. after another save).
          key={`${meeting.id}|${meeting.scheduledAt ?? ''}`}
          meeting={meeting}
          onUpdate={updateMeeting}
          onDelete={async (notify) => {
            await deleteMeeting(notify);
            onBack();
          }}
        />
      )}

      <AgendaMinutes meeting={meeting} canWrite={canWrite} onSave={(agenda, minutes) => updateMeeting({ agenda, minutes }).then(() => undefined)} />

      {ownInvite && (
        <SectionCard title={t('treffen.rsvp.title')}>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">
            {t('treffen.rsvp.current')}: {t(`treffen.rsvp.response.${ownInvite.response}`)}
          </Text>
          {rsvpError ? <Text className="text-destructive text-sm mb-2">{rsvpError}</Text> : null}
          <View className="flex-row" style={{ gap: 10 }}>
            <TouchableOpacity accessibilityRole="button"
              className={`bg-primary dark:bg-primary-dark rounded-lg py-2 px-4 ${rsvpSaving ? 'opacity-70' : ''}`}
              onPress={() => void handleRespond('zugesagt')}
              disabled={rsvpSaving}
            >
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">
                {t('treffen.rsvp.accept')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              className={`bg-muted dark:bg-muted-dark rounded-lg py-2 px-4 ${rsvpSaving ? 'opacity-70' : ''}`}
              onPress={() => void handleRespond('abgesagt')}
              disabled={rsvpSaving}
            >
              <Text className="text-foreground dark:text-foreground-dark text-xs font-bold">{t('treffen.rsvp.decline')}</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>
      )}

      {canWrite && (
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
            <TouchableOpacity accessibilityRole="button" className="bg-muted dark:bg-muted-dark rounded-lg py-2.5 px-3" onPress={handleAddCandidate}>
              <Text className="text-foreground dark:text-foreground-dark text-xs font-bold">{t('treffen.overlap.add-candidate')}</Text>
            </TouchableOpacity>
          </View>

          {overlapError ? <Text className="text-destructive text-sm mt-2">{overlapError}</Text> : null}

          <TouchableOpacity accessibilityRole="button"
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

      )}

      {canWrite && <MeetingInvitees invitees={invitees} directory={members} nameFor={nameFor} onAdd={addInvitee} onRemove={removeInvitee} />}

      {canWrite && <MeetingAttendance invitees={invitees} attendance={attendance} directory={members} nameFor={nameFor} onSave={recordAttendance} />}

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
              {r.correctionNote ? (
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1.5">
                  {r.correctedAt ? `${t('treffen.resolutions.corrected', { date: new Date(r.correctedAt).toLocaleDateString() })} · ` : ''}
                  {t('treffen.resolutions.correction-note.label', { note: r.correctionNote })}
                </Text>
              ) : null}
              {canWrite && correctingId !== r.id ? (
                <TouchableOpacity
                  className="self-start mt-1.5"
                  style={{ minHeight: 36, justifyContent: 'center' }}
                  onPress={() => setCorrectingId(r.id)}
                  accessibilityRole="button"
                >
                  <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('treffen.resolutions.correct')}</Text>
                </TouchableOpacity>
              ) : null}
              {canWrite && correctingId === r.id ? (
                <ResolutionCorrection
                  resolution={r}
                  onSubmit={(body) => correctResolution(r.id, body)}
                  onClose={() => setCorrectingId(null)}
                />
              ) : null}
            </View>
          ))
        )}

        {!canWrite ? null : showResolutionForm ? (
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
            <TouchableOpacity accessibilityRole="button"
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
          <TouchableOpacity accessibilityRole="button" className="self-start mt-2" onPress={() => setShowResolutionForm(true)}>
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('treffen.resolutions.create')}</Text>
          </TouchableOpacity>
        )}
      </SectionCard>
    </>
  );
}

export default function TreffenTab({ clubId }: Props) {
  const { can } = useOwnMembership(clubId);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  return selectedMeetingId ? (
    <MeetingDetail clubId={clubId} meetingId={selectedMeetingId} onBack={() => setSelectedMeetingId(null)} />
  ) : (
    <MeetingList clubId={clubId} canWrite={can('meetings:write')} onSelect={setSelectedMeetingId} />
  );
}
