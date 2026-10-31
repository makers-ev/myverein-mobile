import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useClubStats } from '@/hooks/useClubStats';

const TOP_CATEGORIES = 5;

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center" accessible accessibilityLabel={`${label}: ${value}`}>
      <Text className="text-foreground dark:text-foreground-dark text-2xl font-black">{value}</Text>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs text-center">{label}</Text>
    </View>
  );
}

/**
 * Member-count KPI card (`GET /club-stats`, counts only). The caller renders it
 * only with `club_stats:read`; categories are drawn as plain bars, no chart dependency.
 */
export default function MemberStatsCard({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { stats, loading, error, refetch } = useClubStats(clubId, true);

  const categories = stats ? stats.byCategory.filter((c) => c.count > 0).slice().sort((a, b) => b.count - a.count).slice(0, TOP_CATEGORIES) : [];
  const maxCount = categories.reduce((max, c) => Math.max(max, c.count), 0);

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3" accessibilityRole="header">
        {t('verein.stats.title')}
      </Text>

      {loading && !stats ? (
        <View className="py-6 items-center" accessibilityLabel={t('verein.stats.loading')}>
          <ActivityIndicator color={themeColors.primary} />
        </View>
      ) : error && !stats ? (
        <View>
          <Text className="text-destructive dark:text-destructive-dark text-sm mb-2" accessibilityRole="alert">
            {t('verein.stats.error')}
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
            style={{ minHeight: 44 }}
            accessibilityRole="button"
          >
            <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : stats ? (
        <>
          <View className="flex-row mb-4" style={{ gap: 8 }}>
            <Figure value={stats.members.total} label={t('verein.stats.total')} />
            <Figure value={stats.members.active} label={t('verein.stats.active')} />
            <Figure value={stats.members.withAccount} label={t('verein.stats.with-account')} />
            <Figure value={stats.members.withoutAccount} label={t('verein.stats.without-account')} />
          </View>

          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-2">{t('verein.stats.categories')}</Text>
          {categories.length === 0 ? (
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.stats.categories.empty')}</Text>
          ) : (
            categories.map((c) => (
              <View key={c.key} className="mb-2" accessible accessibilityLabel={`${c.name}: ${c.count}`}>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-foreground dark:text-foreground-dark text-sm">{c.name}</Text>
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm font-semibold">{c.count}</Text>
                </View>
                <View className="h-2 rounded-full bg-muted dark:bg-muted-dark overflow-hidden">
                  <View
                    className="h-2 rounded-full bg-primary dark:bg-primary-dark"
                    style={{ width: `${maxCount > 0 ? Math.max(4, Math.round((c.count / maxCount) * 100)) : 0}%` }}
                  />
                </View>
              </View>
            ))
          )}
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t('verein.stats.hint')}</Text>
        </>
      ) : null}
    </View>
  );
}
