import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Baby, Clock, Paperclip, ShieldCheck } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import ClubsLoadError from '@/components/verein/ClubsLoadError';
import ApplicationReviewSheet, { type DecisionOutcome } from '@/components/verein/ApplicationReviewSheet';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useClubApplications, type ClubApplication } from '@/hooks/useClubApplications';

const SUMMARY_ITEMS = 3;

function ApplicationCard({ application, onOpen }: { application: ClubApplication; onOpen: () => void }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const child = application.onBehalfOf === 'guardian';
  const title = application.subjectName ?? application.name ?? application.email ?? '—';
  const summary = application.summary.slice(0, SUMMARY_ITEMS);
  return (
    <TouchableOpacity
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${t('forms.review.open')}: ${title}`}
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3"
    >
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <View className="flex-1">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">{title}</Text>
          {child ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">
              {t('forms.review.list.forChild', { name: application.name ?? application.email ?? '—' })}
            </Text>
          ) : application.email ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{application.email}</Text>
          ) : null}
        </View>
        {child ? (
          <View className="flex-row items-center bg-primary/10 dark:bg-primary-dark/10 px-2 py-0.5 rounded-full" style={{ gap: 4 }}>
            <Baby size={12} color={themeColors.primary} />
            <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('forms.review.badge.child')}</Text>
          </View>
        ) : application.legacy ? (
          <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{t('forms.review.badge.legacy')}</Text>
          </View>
        ) : null}
      </View>

      {summary.length > 0 ? (
        <View className="mt-2" accessibilityLabel={t('forms.review.list.summary')}>
          {summary.map((item) => (
            <Text key={item.key} className="text-xs text-foreground dark:text-foreground-dark" numberOfLines={1}>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark">{item.label}: </Text>
              {item.display}
            </Text>
          ))}
        </View>
      ) : application.category ? (
        <Text className="text-xs mt-2 text-foreground dark:text-foreground-dark">{t(`verein.category.${application.category}`)}</Text>
      ) : null}

      <View className="flex-row flex-wrap items-center mt-2" style={{ gap: 10 }}>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Clock size={12} color={themeColors.mutedForeground} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {t('verein.applications.submitted')}: {new Date(application.createdAt).toLocaleDateString(language)}
          </Text>
        </View>
        {application.fileCount > 0 ? (
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Paperclip size={12} color={themeColors.mutedForeground} />
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('forms.review.list.files', { n: application.fileCount })}</Text>
          </View>
        ) : null}
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <ShieldCheck size={12} color={application.consentGiven === false ? themeColors.destructive : themeColors.mutedForeground} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
            {t(application.consentGiven === null ? 'forms.review.list.consentNone' : application.consentGiven ? 'forms.review.list.consentGiven' : 'forms.review.list.consentMissing')}
          </Text>
        </View>
      </View>

      <View
        className="bg-primary dark:bg-primary-dark rounded-lg mt-3 items-center justify-center"
        style={{ minHeight: 44 }}
        accessible={false}
      >
        <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('forms.review.open')}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Board view of open join applications (`GET /club-applications`, paged): a summary card per application, a tap opens the
 * review sheet (answers, photo, consent evidence, mapping preview, duplicates, warnings) where the board accepts
 * (optionally with another category) or rejects (internal note and applicant message apart). Only reachable from
 * `VereinScreen` when `permissions` contains `members:write`; the backend enforces the same permission on every call.
 * Editing the form itself stays on the website.
 */
export default function ClubApplicationsScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { activeClub, error: clubsError, loading: clubsLoading } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { can, loading: membershipLoading } = useOwnMembership(clubId);
  const { applications, page, pageSize, total, loading, error, refetch, goToPage, approve, reject } = useClubApplications(clubId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);

  const opened = applications.find((a) => a.id === openId) ?? null;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const handleDecided = useCallback(
    (result: DecisionOutcome | null) => {
      if (result) {
        setOutcome(result);
        setOpenId(null);
      } else {
        // stale: someone else decided -- the sheet stays (read-only) and the list reloads behind it
        void refetch(true);
      }
    },
    [refetch],
  );

  const initialLoading = clubsLoading || membershipLoading || (loading && applications.length === 0 && !error);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4 pb-3">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark" accessibilityRole="header">
          {t('verein.applications.title')}
        </Text>
        {can('members:write') && total > 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">
            {t(total === 1 ? 'forms.review.list.totalOne' : 'forms.review.list.total', { total })}
          </Text>
        ) : null}
      </View>

      {initialLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !can('members:write') ? (
        // Defense in depth: the entry point is hidden without the
        // permission, and the backend would 403 anyway.
        <View className="px-6">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.applications.forbidden')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refetch()} tintColor={themeColors.primary} />}
        >
          {outcome ? (
            <View
              className="rounded-lg border border-success/40 dark:border-success-dark/40 bg-success/10 dark:bg-success-dark/10 p-3 mb-3"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text className="text-sm text-foreground dark:text-foreground-dark">
                {t(
                  outcome.action === 'rejected'
                    ? 'forms.review.outcome.rejected'
                    : outcome.child
                      ? 'forms.review.outcome.approvedChild'
                      : 'forms.review.outcome.approved',
                  { name: outcome.name },
                )}
              </Text>
              {outcome.skipped > 0 ? (
                <Text className="text-sm mt-1 text-warning dark:text-warning-dark">{t('forms.review.outcome.skipped', { n: outcome.skipped })}</Text>
              ) : null}
              <TouchableOpacity onPress={() => setOutcome(null)} accessibilityRole="button" className="self-start" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.updated.dismiss')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {error ? (
            <View className="items-start mb-3" accessibilityRole="alert">
              <Text className="text-destructive text-sm mb-3">{t('verein.applications.error')}</Text>
              <TouchableOpacity
                className="bg-primary dark:bg-primary-dark rounded-lg px-5 items-center justify-center"
                style={{ minHeight: 44 }}
                onPress={() => void refetch()}
                accessibilityRole="button"
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('verein.applications.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!error && applications.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.applications.empty')}</Text>
          ) : (
            applications.map((a) => <ApplicationCard key={a.id} application={a} onOpen={() => setOpenId(a.id)} />)
          )}

          {pages > 1 ? (
            <View className="flex-row items-center justify-between mt-1" accessibilityLabel={t('forms.review.pagination')}>
              <TouchableOpacity
                onPress={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                accessibilityRole="button"
                className={`border border-border dark:border-border-dark rounded-lg px-4 items-center justify-center ${page <= 1 || loading ? 'opacity-50' : ''}`}
                style={{ minHeight: 44 }}
              >
                <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('forms.review.page.prev')}</Text>
              </TouchableOpacity>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('forms.review.page.of', { page, pages })}</Text>
              <TouchableOpacity
                onPress={() => goToPage(page + 1)}
                disabled={page >= pages || loading}
                accessibilityRole="button"
                className={`border border-border dark:border-border-dark rounded-lg px-4 items-center justify-center ${page >= pages || loading ? 'opacity-50' : ''}`}
                style={{ minHeight: 44 }}
              >
                <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">{t('forms.review.page.next')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}

      {clubId && opened ? (
        <ApplicationReviewSheet
          key={opened.id}
          clubId={clubId}
          application={opened}
          onClose={() => setOpenId(null)}
          onDecided={handleDecided}
          approve={approve}
          reject={reject}
        />
      ) : null}
    </SafeAreaView>
  );
}
