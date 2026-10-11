import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { buildResolutionCorrection, type ResolutionCorrectionBody } from '@/lib/resolutionCorrection';
import type { MeetingResolution } from '@/hooks/useMeetingDetail';

const inputClass =
  'bg-muted dark:bg-muted-dark rounded-lg p-2.5 text-sm text-foreground dark:text-foreground-dark border border-border dark:border-border-dark';

/** Inline "Beschluss korrigieren" form (`meetings:write`): edit values, mandatory Berichtigungsvermerk. */
export default function ResolutionCorrection({
  resolution,
  onSubmit,
  onClose,
}: {
  resolution: MeetingResolution;
  onSubmit: (body: ResolutionCorrectionBody) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [description, setDescription] = useState(resolution.description);
  const [votesFor, setVotesFor] = useState(String(resolution.votesFor));
  const [votesAgainst, setVotesAgainst] = useState(String(resolution.votesAgainst));
  const [votesAbstain, setVotesAbstain] = useState(String(resolution.votesAbstain));
  const [result, setResult] = useState(resolution.result);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = { description, votesFor, votesAgainst, votesAbstain, result, correctionNote: note };
  const built = buildResolutionCorrection(resolution, draft);
  const canSubmit = typeof built === 'object' && !saving;

  const submit = async () => {
    if (typeof built !== 'object' || saving) {
      if (built === 'no-change') setError(t('treffen.resolutions.correct.nochange'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(built);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="mt-2 pt-3 border-t border-border dark:border-border-dark">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('treffen.resolutions.correct.hint')}</Text>
      <TextInput className={`${inputClass} mb-3`} value={description} onChangeText={setDescription} placeholder={t('treffen.resolutions.description')} placeholderTextColor={themeColors.mutedForeground} />
      <View className="flex-row" style={{ gap: 8 }}>
        {(
          [
            ['treffen.resolutions.votes-for', votesFor, setVotesFor],
            ['treffen.resolutions.votes-against', votesAgainst, setVotesAgainst],
            ['treffen.resolutions.votes-abstain', votesAbstain, setVotesAbstain],
          ] as const
        ).map(([label, value, setter]) => (
          <View key={label} className="flex-1">
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">{t(label)}</Text>
            <TextInput className={inputClass} keyboardType="number-pad" value={value} onChangeText={setter} />
          </View>
        ))}
      </View>
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1 mt-3">{t('treffen.resolutions.result')}</Text>
      <TextInput className={`${inputClass} mb-3`} value={result} onChangeText={setResult} placeholder={t('treffen.resolutions.result.placeholder')} placeholderTextColor={themeColors.mutedForeground} />
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mb-1">{t('treffen.resolutions.correction-note')}</Text>
      <TextInput
        className={`${inputClass} mb-3`}
        value={note}
        onChangeText={setNote}
        placeholder={t('treffen.resolutions.correction-note.placeholder')}
        placeholderTextColor={themeColors.mutedForeground}
        multiline
        style={{ minHeight: 64, textAlignVertical: 'top' }}
        maxLength={2000}
      />
      {error ? <Text className="text-destructive text-sm mb-3">{error}</Text> : null}
      <View className="flex-row items-center" style={{ gap: 16 }}>
        <TouchableOpacity
          className={`flex-1 bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center ${canSubmit ? '' : 'opacity-60'}`}
          onPress={() => void submit()}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={themeColors.primaryForeground} size="small" />
          ) : (
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-bold">{t('treffen.resolutions.correct.submit')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} disabled={saving} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{t('treffen.resolutions.correct.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
