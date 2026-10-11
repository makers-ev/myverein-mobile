import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { navigate } from '@/navigation/navigationRef';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import {
  LIVE_MEMBER_STATUSES,
  MEMBER_STATUSES,
  useClubMembers,
  useMemberCategories,
  type ClubMember,
  type MemberStatus,
} from '@/hooks/useClubMembers';
import MemberStatsCard from './MemberStatsCard';
import MemberDetailSheet, { categoryLabel, formatDay } from './MemberDetailSheet';

const SEARCH_DEBOUNCE_MS = 350;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 rounded-full justify-center ${selected ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'}`}
      style={{ minHeight: 44 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text
        className={`text-sm font-semibold ${
          selected ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MemberRow({ member, showStatus, onPress }: { member: ClubMember; showStatus: boolean; onPress?: () => void }) {
  const { t, language } = useLanguage();
  const category = categoryLabel(member);
  const activeDepartments = member.departments.filter((d) => d.until === null).map((d) => d.name);
  const joined = formatDay(member.joinedAt, language);

  const content = (
    <>
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <Text className="flex-1 text-foreground dark:text-foreground-dark font-bold text-sm">{member.name ?? '—'}</Text>
        {category ? (
          <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{category}</Text>
          </View>
        ) : null}
      </View>
      {showStatus || !member.hasAccount ? (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
          {showStatus ? (
            <View className="bg-primary/10 dark:bg-primary-dark/10 px-2 py-0.5 rounded-full">
              <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t(`verein.status.${member.effectiveStatus}`)}</Text>
            </View>
          ) : null}
          {showStatus && !member.hasAccount ? (
            <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{t('verein.members.account.no')}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {activeDepartments.length > 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">{activeDepartments.join(', ')}</Text>
      ) : null}
      {member.roles.length > 0 ? (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
          {member.roles.map((r) => (
            <View key={r.id} className="bg-primary/10 dark:bg-primary-dark/10 px-2 py-0.5 rounded-full">
              <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t(`verein.role.${r.roleType}`)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {joined ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">
          {t('verein.members.joined')}: {joined}
        </Text>
      ) : null}
    </>
  );

  const cardClass = 'bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3';
  if (!onPress) return <View className={cardClass}>{content}</View>;
  return (
    <TouchableOpacity
      className={cardClass}
      style={{ minHeight: 44 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${member.name ?? '—'}. ${t('verein.members.open-detail')}`}
    >
      {content}
    </TouchableOpacity>
  );
}

/**
 * Mitglieder tab. Everybody gets the readable, paged list (only fields the
 * backend delivers). With `members:write` or `members:read_sensitive` it adds
 * search, status/category filters and a read-only detail sheet; with
 * `club_stats:read` the member-count KPI card. Create/edit/import are
 * deliberately web-only.
 */
export default function MembersTab({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { can, loading: membershipLoading } = useOwnMembership(clubId);
  const isManager = can('members:write') || can('members:read_sensitive');
  const canSeeStats = can('club_stats:read');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus[]>([]);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClubMember | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Plain members only see people who are still in the club; the board sees all unless filtered.
  const filters = useMemo(
    () =>
      isManager
        ? { q: debouncedSearch, status: statusFilter, category: categoryKey ? [categoryKey] : [] }
        : { status: LIVE_MEMBER_STATUSES },
    [isManager, debouncedSearch, statusFilter, categoryKey],
  );

  const { categories } = useMemberCategories(clubId, isManager);
  const { members, total, loading, loadingMore, error, loadMoreError, hasMore, refetch, loadMore } = useClubMembers(
    membershipLoading ? null : clubId,
    filters,
  );

  const filtersActive = isManager && (debouncedSearch.trim() !== '' || statusFilter.length > 0 || categoryKey !== null);
  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter([]);
    setCategoryKey(null);
  };
  const toggleStatus = (s: MemberStatus) =>
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const applicationsEntry = can('members:write') ? (
    <TouchableOpacity
      className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3 flex-row items-center justify-between"
      style={{ minHeight: 48 }}
      onPress={() => navigate('ClubApplications')}
      accessibilityRole="button"
      accessibilityLabel={t('verein.applications.open')}
    >
      <Text className="text-primary dark:text-primary-dark font-bold text-sm">{t('verein.applications.open')}</Text>
      <Text className="text-primary dark:text-primary-dark font-bold text-sm">›</Text>
    </TouchableOpacity>
  ) : null;

  if (membershipLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      {applicationsEntry}
      {canSeeStats ? <MemberStatsCard clubId={clubId} /> : null}

      {isManager ? (
        <View className="mb-3">
          <TextInput
            className="border border-border dark:border-border-dark bg-card dark:bg-card-dark rounded-xl px-3 text-foreground dark:text-foreground-dark text-sm"
            style={{ minHeight: 44 }}
            value={search}
            onChangeText={setSearch}
            placeholder={t('verein.members.search.placeholder')}
            placeholderTextColor={themeColors.mutedForeground}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
            maxLength={100}
            accessibilityLabel={t('verein.members.search.label')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
            <Chip label={t('verein.members.filter.all')} selected={statusFilter.length === 0} onPress={() => setStatusFilter([])} />
            {MEMBER_STATUSES.map((s) => (
              <Chip key={s} label={t(`verein.status.${s}`)} selected={statusFilter.includes(s)} onPress={() => toggleStatus(s)} />
            ))}
          </ScrollView>
          {categories.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              <Chip label={t('verein.members.filter.all-categories')} selected={categoryKey === null} onPress={() => setCategoryKey(null)} />
              {categories.map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryKey === c.key} onPress={() => setCategoryKey(categoryKey === c.key ? null : c.key)} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {loading && members.length === 0 ? (
        <View className="py-12 items-center" accessibilityLabel={t('verein.members.loading')}>
          <ActivityIndicator color={themeColors.primary} />
        </View>
      ) : error ? (
        <View className="py-6">
          <Text className="text-destructive text-sm mb-3" accessibilityRole="alert">
            {t('verein.members.error')}
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            className="self-start px-5 justify-center rounded-lg bg-primary dark:bg-primary-dark"
            style={{ minHeight: 44 }}
            accessibilityRole="button"
          >
            <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('verein.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : members.length === 0 ? (
        <View className="py-4">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">
            {filtersActive ? t('verein.members.empty.filtered') : t('verein.members.empty')}
          </Text>
          {filtersActive ? (
            <TouchableOpacity
              onPress={resetFilters}
              className="self-start px-5 justify-center rounded-lg border border-border dark:border-border-dark"
              style={{ minHeight: 44 }}
              accessibilityRole="button"
            >
              <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.members.filter.reset')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2" accessibilityLiveRegion="polite">
            {t('verein.members.count', { shown: members.length, total })}
          </Text>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} showStatus={isManager} onPress={isManager ? () => setSelected(m) : undefined} />
          ))}
          {loadMoreError ? (
            <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
              {t('verein.members.load-more.error')}
            </Text>
          ) : null}
          {hasMore ? (
            <TouchableOpacity
              onPress={() => void loadMore()}
              disabled={loadingMore}
              className="items-center justify-center rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark"
              style={{ minHeight: 48 }}
              accessibilityRole="button"
              accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
            >
              {loadingMore ? (
                <ActivityIndicator color={themeColors.primary} />
              ) : (
                <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.members.load-more')}</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <MemberDetailSheet member={selected} onClose={() => setSelected(null)} />
    </>
  );
}
