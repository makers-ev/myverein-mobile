import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useClubApplications, type ClubApplication } from '@/hooks/useClubApplications';

function ApplicationCard({
  application,
  busy,
  onApprove,
  onReject,
}: {
  application: ClubApplication;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3">
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <View className="flex-1">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-sm">{application.name ?? '—'}</Text>
          {application.email ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5">{application.email}</Text>
          ) : null}
        </View>
        {application.category ? (
          <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">
              {t(`verein.category.${application.category}`)}
            </Text>
          </View>
        ) : null}
      </View>
      {application.birthDate ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">
          {t('verein.applications.birth-date')}: {new Date(application.birthDate).toLocaleDateString()}
        </Text>
      ) : null}
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">
        {t('verein.applications.submitted')}: {new Date(application.createdAt).toLocaleDateString()}
      </Text>

      <View className="flex-row mt-3" style={{ gap: 8 }}>
        <TouchableOpacity
          className={`flex-1 bg-primary dark:bg-primary-dark rounded-lg py-2.5 items-center ${busy ? 'opacity-70' : ''}`}
          onPress={onApprove}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={themeColors.primaryForeground} />
          ) : (
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
              {t('verein.applications.approve')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 rounded-lg py-2.5 items-center border border-border dark:border-border-dark ${busy ? 'opacity-70' : ''}`}
          onPress={onReject}
          disabled={busy}
        >
          <Text className="text-destructive text-sm font-bold">{t('verein.applications.reject')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Board view of open join applications (`GET /club-applications`). Only
 * reachable from `VereinScreen` when `permissions` contains `members:write`;
 * the backend enforces the same permission on every call.
 */
export default function ClubApplicationsScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { activeClub, loading: clubsLoading } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { can, loading: membershipLoading } = useOwnMembership(clubId);
  const { applications, loading, error, refetch, approve, reject } = useClubApplications(clubId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, fn: (id: string) => Promise<void>) => {
      setBusyId(id);
      setActionError(null);
      try {
        await fn(id);
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : t('verein.applications.action-error'));
        void refetch();
      } finally {
        setBusyId(null);
      }
    },
    [refetch, t],
  );

  const confirmReject = (application: ClubApplication) => {
    Alert.alert(
      t('verein.applications.reject.title'),
      t('verein.applications.reject.message', { name: application.name ?? application.email ?? '—' }),
      [
        { text: t('verein.applications.cancel'), style: 'cancel' },
        { text: t('verein.applications.reject'), style: 'destructive', onPress: () => void run(application.id, reject) },
      ],
    );
  };

  const initialLoading = clubsLoading || membershipLoading || (loading && applications.length === 0 && !error);

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4 pb-3">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark">{t('verein.applications.title')}</Text>
      </View>

      {initialLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !can('members:write') ? (
        // Defense in depth: the entry point is hidden without the
        // permission, and the backend would 403 anyway.
        <View className="px-6">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.applications.error')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refetch()} tintColor={themeColors.primary} />}
        >
          {actionError ? <Text className="text-destructive text-sm mb-3">{actionError}</Text> : null}
          {error ? (
            <View className="items-start">
              <Text className="text-destructive text-sm mb-3">{t('verein.applications.error')}</Text>
              <TouchableOpacity
                className="bg-primary dark:bg-primary-dark rounded-lg py-2.5 px-5"
                onPress={() => void refetch()}
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
                  {t('verein.applications.retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : applications.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.applications.empty')}</Text>
          ) : (
            applications.map((a) => (
              <ApplicationCard
                key={a.id}
                application={a}
                busy={busyId === a.id}
                onApprove={() => void run(a.id, approve)}
                onReject={() => confirmReject(a)}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
