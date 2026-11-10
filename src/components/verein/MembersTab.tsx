import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocsLink from '@/components/ui/DocsLink';
import { DOCS_PATHS } from '@/lib/docsUrl';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';

import OfflineNotice from '@/components/ui/OfflineNotice';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { UserPlus } from 'lucide-react-native';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import FilterChip from '@/components/ui/FilterChip';
import ListRow from '@/components/ui/ListRow';
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
import CredentialOverview from './CredentialOverview';
import MemberStatsCard from './MemberStatsCard';
import MemberAvatar from './MemberAvatar';
import MemberDetailSheet, { categoryLabel, formatDay } from './MemberDetailSheet';

const SEARCH_DEBOUNCE_MS = 350;
const PHOTO_REFRESH_MS = 10_000;

function MemberRow({
  member,
  showStatus,
  divider,
  onPress,
  onPhotoExpired,
}: {
  member: ClubMember;
  showStatus: boolean;
  /** Hairline above the row (every row but the first in the grouped list). */
  divider: boolean;
  onPress?: () => void;
  onPhotoExpired?: () => void;
}) {
  const { t, language } = useLanguage();
  const category = categoryLabel(member);
  const activeDepartments = member.departments.filter((d) => d.until === null).map((d) => d.name);
  const joined = formatDay(member.joinedAt, language);

  const isBoard = member.roles.length > 0;
  const meta = [activeDepartments.join(', ') || null, category].filter(Boolean).join(' · ');
  const content = (
    <View className="flex-row items-start px-4 py-3" style={{ gap: 12 }}>
      <MemberAvatar name={member.name} photoUrl={member.photoUrl} size={40} onExpired={onPhotoExpired} />
      <View className="flex-1">
        <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px]">{member.name ?? '—'}</Text>
        {meta ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-0.5">{meta}</Text> : null}
        {isBoard || showStatus || !member.hasAccount ? (
          <View className="flex-row flex-wrap mt-1.5" style={{ gap: 6 }}>
            {member.roles.map((r) => (
              <Badge key={r.id} tone="accent">
                {t(`verein.role.${r.roleType}`)}
              </Badge>
            ))}
            {showStatus ? <Badge tone="primary">{t(`verein.status.${member.effectiveStatus}`)}</Badge> : null}
            {!member.hasAccount && showStatus ? <Badge>{t('verein.members.account.no')}</Badge> : null}
          </View>
        ) : null}
        {joined && showStatus ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-1" style={{ fontVariant: ['tabular-nums'] }}>
            {t('verein.members.joined')}: {joined}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View>
        {divider ? <View className="bg-border dark:bg-border-dark" style={{ height: 1, marginLeft: 68 }} /> : null}
        {content}
      </View>
    );
  }
  return (
    <View>
      {divider ? <View className="bg-border dark:bg-border-dark" style={{ height: 1, marginLeft: 68 }} /> : null}
      <TouchableOpacity
        style={{ minHeight: 44 }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${member.name ?? '—'}. ${t('verein.members.open-detail')}`}
      >
        {content}
      </TouchableOpacity>
    </View>
  );
}

/**
 * Mitglieder tab. Everybody gets the readable, paged list (only fields the
 * backend delivers). With `members:write` or `members:read_sensitive` it adds
 * search, status/category filters and a read-only detail sheet; with
 * `club_stats:read` the member-count KPI card. Create/edit/import are
 * deliberately web-only.
 */
export default function MembersTab({ clubId, memberId }: { clubId: string; memberId?: string }) {
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
  const { members, total, loading, loadingMore, error, loadMoreError, hasMore, staleAt, refetch, loadMore } = useClubMembers(
    membershipLoading ? null : clubId,
    filters,
  );

  // Expired photo signatures: refetch the list (fresh URLs), at most once per 10 s however many avatars fail at once.
  const lastPhotoRefresh = useRef(0);
  const photoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshForPhotos = useCallback(() => {
    const wait = PHOTO_REFRESH_MS - (Date.now() - lastPhotoRefresh.current);
    if (wait > 0) {
      // Throttled: schedule one trailing refetch so avatars that failed meanwhile still get fresh URLs.
      if (!photoTimer.current) {
        photoTimer.current = setTimeout(() => {
          photoTimer.current = null;
          lastPhotoRefresh.current = Date.now();
          void refetch();
        }, wait);
      }
      return;
    }
    lastPhotoRefresh.current = Date.now();
    void refetch();
  }, [refetch]);
  useEffect(
    () => () => {
      if (photoTimer.current) clearTimeout(photoTimer.current);
    },
    [],
  );

  // Opened from the search with a member: open the detail sheet as soon as that row is in the loaded list.
  useEffect(() => {
    const hit = memberId ? members.find((m) => m.id === memberId) : undefined;
    if (hit) setSelected((prev) => (prev?.id === hit.id ? prev : hit));
  }, [memberId, members]);

  // The sheet shows the freshest list row, falling back to the tapped snapshot (e.g. after a refetch dropped page 2).
  // Right after a photo change the response's fresh URL wins until the list refetch has settled.
  const [photoOverride, setPhotoOverride] = useState<{ id: string; url: string | null } | null>(null);
  const sheetRow = selected ? (members.find((m) => m.id === selected.id) ?? selected) : null;
  const sheetMember = sheetRow && loading && photoOverride?.id === sheetRow.id ? { ...sheetRow, photoUrl: photoOverride.url } : sheetRow;
  const handlePhotoChanged = (updated: ClubMember | null, memberId: string) => {
    // Only touch the open sheet if it still shows the member the result is for (never re-select or open another one).
    if (selected && selected.id === memberId) {
      const url = updated?.photoUrl ?? null;
      setSelected({ ...selected, photoUrl: url });
      setPhotoOverride({ id: memberId, url });
    }
    lastPhotoRefresh.current = Date.now();
    void refetch();
  };

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
    <ListRow title={t('verein.applications.open')} icon={UserPlus} onPress={() => navigate('ClubApplications')} />
  ) : null;

  if (membershipLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primaryText} />
      </View>
    );
  }

  return (
    <>
      {applicationsEntry}
      {canSeeStats ? <MemberStatsCard clubId={clubId} /> : null}
      {/* Hidden unless the server delivers readable credential fields for this caller (board, trainers, Abteilungsleitung). */}
      <CredentialOverview key={clubId} clubId={clubId} />

      {isManager ? (
        <View className="mb-3">
          <TextInput
            className="border border-border-control dark:border-border-control-dark bg-card dark:bg-card-dark rounded-[10px] px-3 text-foreground dark:text-foreground-dark text-[17px]"
            style={{ minHeight: 48 }}
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
            <FilterChip label={t('verein.members.filter.all')} selected={statusFilter.length === 0} onPress={() => setStatusFilter([])} />
            {MEMBER_STATUSES.map((s) => (
              <FilterChip key={s} label={t(`verein.status.${s}`)} selected={statusFilter.includes(s)} onPress={() => toggleStatus(s)} />
            ))}
          </ScrollView>
          {categories.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              <FilterChip label={t('verein.members.filter.all-categories')} selected={categoryKey === null} onPress={() => setCategoryKey(null)} />
              {categories.map((c) => (
                <FilterChip key={c.id} label={c.name} selected={categoryKey === c.key} onPress={() => setCategoryKey(categoryKey === c.key ? null : c.key)} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {staleAt ? <OfflineNotice savedAt={staleAt} /> : null}
      {loading && members.length === 0 ? (
        <View className="py-12 items-center" accessibilityLabel={t('verein.members.loading')}>
          <ActivityIndicator color={themeColors.primaryText} />
        </View>
      ) : error ? (
        <ErrorState fallbackKey="verein.members.error" onRetry={() => void refetch()} />
      ) : members.length === 0 ? (
        <View className="py-4">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mb-3">
            {filtersActive ? t('verein.members.empty.filtered') : t('verein.members.empty')}
          </Text>
          {!filtersActive ? <DocsLink path={DOCS_PATHS.members} /> : null}
          {filtersActive ? <Button variant="secondary" size="M" label={t('verein.members.filter.reset')} onPress={resetFilters} /> : null}
        </View>
      ) : (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 px-1" accessibilityLiveRegion="polite" style={{ fontVariant: ['tabular-nums'] }}>
            {t('verein.members.count', { shown: members.length, total })}
          </Text>
          <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] overflow-hidden mb-3">
            {members.map((m, i) => (
              <MemberRow
                key={m.id}
                divider={i > 0}
                member={m}
                showStatus={isManager}
                onPress={isManager ? () => setSelected(m) : undefined}
                onPhotoExpired={refreshForPhotos}
              />
            ))}
          </View>
          {loadMoreError ? (
            <Text className="text-destructive dark:text-destructive-dark text-sm mb-2" accessibilityRole="alert">
              {t('verein.members.load-more.error')}
            </Text>
          ) : null}
          {hasMore ? (
            <TouchableOpacity
              onPress={() => void loadMore()}
              disabled={loadingMore}
              className="items-center justify-center rounded-[10px] border border-border-control dark:border-border-control-dark bg-card dark:bg-card-dark"
              style={{ minHeight: 48 }}
              accessibilityRole="button"
              accessibilityLabel={t('verein.members.load-more')}
              accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
            >
              {loadingMore ? (
                <ActivityIndicator color={themeColors.primaryText} />
              ) : (
                <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('verein.members.load-more')}</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <MemberDetailSheet
        member={sheetMember}
        onClose={() => setSelected(null)}
        clubId={clubId}
        canEditPhoto={can('members:write')}
        onPhotoChanged={handlePhotoChanged}
        onPhotoExpired={refreshForPhotos}
      />
    </>
  );
}
