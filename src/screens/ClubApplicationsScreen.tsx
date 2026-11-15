import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Baby, Clock, Inbox, Paperclip, ShieldCheck } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import ClubsLoadError from '@/components/verein/ClubsLoadError';
import ApplicationReviewSheet, { type DecisionOutcome } from '@/components/verein/ApplicationReviewSheet';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useClubApplications, type ClubApplication } from '@/hooks/useClubApplications';
import Badge from '@/components/ui/Badge';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';

const SUMMARY_ITEMS = 3;

function ApplicationRow({ application, onOpen, first }: { application: ClubApplication; onOpen: () => void; first: boolean }) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const child = application.onBehalfOf === 'guardian';
  const title = application.subjectName ?? application.name ?? application.email ?? '—';
  const summary = application.summary.slice(0, SUMMARY_ITEMS);
  return (
    <View className={`p-4 ${first ? '' : 'border-t border-border dark:border-border-dark'}`}>
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-semibold text-[17px] leading-[22px]">{title}</Text>
          {child ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">
              {t('forms.review.list.forChild', { name: application.name ?? application.email ?? '—' })}
            </Text>
          ) : application.email ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{application.email}</Text>
          ) : null}
        </View>
        {child ? (
          <Badge tone="primary" icon={Baby}>
            {t('forms.review.badge.child')}
          </Badge>
        ) : application.legacy ? (
          <Badge>{t('forms.review.badge.legacy')}</Badge>
        ) : null}
      </View>

      {summary.length > 0 ? (
        <View className="mt-2" accessibilityLabel={t('forms.review.list.summary')}>
          {summary.map((item) => (
            <Text key={item.key} className="text-[15px] leading-[22px] text-foreground dark:text-foreground-dark" numberOfLines={1}>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark">{item.label}: </Text>
              {item.display}
            </Text>
          ))}
        </View>
      ) : application.category ? (
        <Text className="text-[15px] leading-[22px] mt-2 text-foreground dark:text-foreground-dark">{t(`verein.category.${application.category}`)}</Text>
      ) : null}

      <View className="flex-row flex-wrap items-center mt-2" style={{ columnGap: 12, rowGap: 4 }}>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Clock size={14} strokeWidth={1.75} color={themeColors.mutedForeground} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]" style={{ fontVariant: ['tabular-nums'] }}>
            {t('verein.applications.submitted')}: {new Date(application.createdAt).toLocaleDateString(language)}
          </Text>
        </View>
        {application.fileCount > 0 ? (
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Paperclip size={14} strokeWidth={1.75} color={themeColors.mutedForeground} />
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]">{t('forms.review.list.files', { n: application.fileCount })}</Text>
          </View>
        ) : null}
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <ShieldCheck size={14} strokeWidth={1.75} color={application.consentGiven === false ? themeColors.destructive : themeColors.mutedForeground} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]">
            {t(application.consentGiven === null ? 'forms.review.list.consentNone' : application.consentGiven ? 'forms.review.list.consentGiven' : 'forms.review.list.consentMissing')}
          </Text>
        </View>
      </View>

      <View className="mt-3">
        <Button block label={t('forms.review.open')} accessibilityLabel={`${t('forms.review.open')}: ${title}`} onPress={onOpen} />
      </View>
    </View>
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
  // Snapshot of the opened application: the list reloads behind the sheet and may drop the row (decided elsewhere), the
  // sheet must stay open and show that instead of vanishing.
  const [opened, setOpened] = useState<ClubApplication | null>(null);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);

  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const handleDecided = useCallback(
    (result: DecisionOutcome | null) => {
      if (result) {
        setOutcome(result);
        setOpened(null);
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
      <View className="px-4 pt-3 pb-3">
        {/* The stack header names the screen (no second large title). */}
        {can('members:write') && total > 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">
            {t(total === 1 ? 'forms.review.list.totalOne' : 'forms.review.list.total', { total })}
          </Text>
        ) : null}
      </View>

      {initialLoading ? (
        <View className="px-4">
          <Skeleton shape="rows" lines={3} />
        </View>
      ) : !activeClub && clubsError ? (
        <ClubsLoadError />
      ) : !can('members:write') ? (
        // Defense in depth: the entry point is hidden without the
        // permission, and the backend would 403 anyway.
        <View className="px-6">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{t('verein.applications.forbidden')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refetch()} tintColor={themeColors.primaryText} />}
        >
          {outcome ? (
            <View className="mb-4" accessibilityLiveRegion="polite">
              <Banner
                tone="success"
                body={t(
                  outcome.action === 'rejected'
                    ? 'forms.review.outcome.rejected'
                    : outcome.child
                      ? 'forms.review.outcome.approvedChild'
                      : 'forms.review.outcome.approved',
                  { name: outcome.name },
                )}
                action={{ label: t('forms.apply.updated.dismiss'), onPress: () => setOutcome(null) }}
              />
              {outcome.skipped > 0 ? (
                <Text className="text-[15px] leading-[22px] mt-2 text-warning dark:text-warning-dark">{t('forms.review.outcome.skipped', { n: outcome.skipped })}</Text>
              ) : null}
            </View>
          ) : null}

          {error ? <ErrorState fallbackKey="verein.applications.error" onRetry={() => void refetch()} /> : null}

          {!error && applications.length === 0 ? (
            <EmptyState icon={Inbox} align="center" title={t('verein.applications.empty')} />
          ) : (
            <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] overflow-hidden">
              {applications.map((a, i) => (
                <ApplicationRow key={a.id} application={a} first={i === 0} onOpen={() => setOpened(a)} />
              ))}
            </View>
          )}

          {pages > 1 ? (
            <View className="flex-row items-center justify-between mt-4" accessibilityLabel={t('forms.review.pagination')}>
              <Button variant="secondary" label={t('forms.review.page.prev')} onPress={() => goToPage(page - 1)} disabled={page <= 1 || loading} />
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px]" style={{ fontVariant: ['tabular-nums'] }}>{t('forms.review.page.of', { page, pages })}</Text>
              <Button variant="secondary" label={t('forms.review.page.next')} onPress={() => goToPage(page + 1)} disabled={page >= pages || loading} />
            </View>
          ) : null}
        </ScrollView>
      )}

      {clubId && opened ? (
        <ApplicationReviewSheet
          key={opened.id}
          clubId={clubId}
          application={opened}
          onClose={() => setOpened(null)}
          onDecided={handleDecided}
          approve={approve}
          reject={reject}
        />
      ) : null}
    </SafeAreaView>
  );
}
