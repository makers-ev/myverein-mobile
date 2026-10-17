import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, Clock, MessageSquare, XCircle } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { type DecidedApplication, formatBerlinDate, type OpenApplication } from '@/lib/applicationStatus';
import type { OnBehalfOf } from '@/lib/formSchema';
import type { MyApplicationsPhase } from '@/hooks/useMyApplications';

interface Props {
  open: OpenApplication[];
  decided: DecidedApplication[];
  phase: MyApplicationsPhase;
  errorKey: string | null;
  disabled?: boolean;
  /** Opens the club's form and resumes the open draft of this mode (the draft is looked up, never created twice). */
  onOpen: (slug: string, mode: OnBehalfOf) => void;
  onRetry: () => void;
}

const forWhom = (mode: OnBehalfOf) => (mode === 'guardian' ? 'forms.apply.open.forChild' : 'forms.apply.open.forSelf');
const clubLabel = (club: { name: string; slug: string }) => club.name || club.slug;

/**
 * Applicant-facing status of the person's own applications: open ones with a "Fortsetzen" button (no retyping of the club
 * code) and the recent decisions per club. A rejected application shows the board's message (plain `Text`, never
 * interpreted), an accepted one points to the Verein tab, a withdrawn one is neutral.
 */
export default function MyApplicationsStatus({ open, decided, phase, errorKey, disabled, onOpen, onRetry }: Props) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();

  if (phase === 'idle') return null;
  if (phase === 'loading') {
    return (
      <View className="flex-row items-center mt-4" style={{ gap: 8 }} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.status.loading')}</Text>
      </View>
    );
  }

  const error =
    errorKey !== null ? (
      <View className="mt-4" accessibilityRole="alert">
        <Text className="text-destructive text-sm">{t('forms.apply.status.loadFailed')}</Text>
        <TouchableOpacity onPress={onRetry} accessibilityRole="button" className="self-start" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.retry')}</Text>
        </TouchableOpacity>
      </View>
    ) : null;

  if (open.length === 0 && decided.length === 0) return error;

  return (
    <View className="mt-5">
      <Text className="text-base font-bold text-foreground dark:text-foreground-dark" accessibilityRole="header">
        {t('forms.apply.status.title')}
      </Text>
      {error}

      {open.length > 0 ? (
        <View className="mt-2">
          <Text className="text-xs font-semibold uppercase text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.status.openTitle')}</Text>
          {open.map((a) => (
            <View key={a.id} className="mt-2 rounded-lg border border-border dark:border-border-dark p-3">
              <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{clubLabel(a.club)}</Text>
              <Text className="text-xs mt-0.5 text-muted-foreground dark:text-muted-foreground-dark">{t(forWhom(a.onBehalfOf))}</Text>
              <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                <Clock size={14} color={colors.primary} />
                <Text className="flex-1 text-xs font-semibold text-primary dark:text-primary-dark">
                  {t(a.status === 'draft' ? 'forms.apply.status.draft' : 'forms.apply.open.waiting')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onOpen(a.club.slug, a.onBehalfOf)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={t('forms.apply.status.resumeA11y', { club: clubLabel(a.club) })}
                className={`self-start mt-2 rounded-lg bg-primary dark:bg-primary-dark px-4 items-center justify-center ${disabled ? 'opacity-60' : ''}`}
                style={{ minHeight: 44 }}
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('forms.apply.status.resume')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {decided.length > 0 ? (
        <View className="mt-4">
          <Text className="text-xs font-semibold uppercase text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.status.decidedTitle')}</Text>
          {decided.map((d) => {
            const Icon = d.status === 'accepted' ? CheckCircle2 : d.status === 'rejected' ? XCircle : Clock;
            const tone = d.status === 'accepted' ? colors.success : d.status === 'rejected' ? colors.destructive : colors.mutedForeground;
            return (
              <View key={d.id} className="mt-2 rounded-lg border border-border dark:border-border-dark p-3">
                <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{clubLabel(d.club)}</Text>
                <Text className="text-xs mt-0.5 text-muted-foreground dark:text-muted-foreground-dark">{t(forWhom(d.onBehalfOf))}</Text>
                <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                  <Icon size={14} color={tone} />
                  <Text className="flex-1 text-xs font-semibold text-foreground dark:text-foreground-dark">
                    {t(`forms.apply.status.${d.status}`)} {t('forms.apply.status.on', { date: formatBerlinDate(d.date, language) })}
                  </Text>
                </View>
                {d.status === 'rejected' && d.decisionNote ? (
                  <View className="mt-2 rounded-lg bg-muted dark:bg-muted-dark p-3">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <MessageSquare size={14} color={colors.mutedForeground} />
                      <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.status.note')}</Text>
                    </View>
                    <Text className="text-sm mt-1 text-foreground dark:text-foreground-dark" selectable>
                      {d.decisionNote}
                    </Text>
                  </View>
                ) : null}
                {d.status === 'accepted' ? (
                  <Text className="text-sm mt-2 text-foreground dark:text-foreground-dark">{t('forms.apply.status.acceptedHint')}</Text>
                ) : null}
                {d.status === 'withdrawn' ? (
                  <Text className="text-sm mt-2 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.status.withdrawnHint')}</Text>
                ) : null}
                {d.status !== 'accepted' ? (
                  <TouchableOpacity
                    onPress={() => onOpen(d.club.slug, d.onBehalfOf)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('forms.apply.status.newApplicationA11y', { club: clubLabel(d.club) })}
                    className={`self-start mt-1 ${disabled ? 'opacity-60' : ''}`}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.status.newApplication')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
