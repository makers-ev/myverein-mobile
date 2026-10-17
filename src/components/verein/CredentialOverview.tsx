import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react-native';

import ExpiryBadge, { formatCredentialDate } from '@/components/forms/ExpiryBadge';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useCredentialOverview } from '@/hooks/useCredentialOverview';
import type { ClubMember } from '@/hooks/useClubMembers';
import { apiFetch } from '@/lib/api';
import {
  credentialSummary,
  DEFAULT_OVERVIEW_QUERY,
  OVERVIEW_PAGE_SIZE,
  OVERVIEW_STATUSES,
  overviewPageCount,
  type OverviewQuery,
  type OverviewStatus,
  WITHIN_DAYS_OPTIONS,
} from '@/lib/credentials';
import { useThemeColors } from '@/theme/colors';
import MemberDetailSheet from './MemberDetailSheet';

function Chip({ label, selected, disabled, onPress, locked }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void; locked?: boolean }) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`px-4 rounded-full justify-center flex-row items-center ${selected ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'} ${disabled ? 'opacity-40' : ''}`}
      style={{ minHeight: 44, gap: 5 }}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
    >
      {locked ? <Lock size={12} color={selected ? colors.primaryForeground : colors.mutedForeground} /> : null}
      <Text
        className={`text-sm font-semibold ${selected ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const mutedClass = 'text-muted-foreground dark:text-muted-foreground-dark text-xs';

/**
 * "Qualifikationen" list for the board and Funktionstraeger (Mitglieder tab): who holds which profile-module credential
 * and until when (`GET /club-members/credentials`). Shown only when the server delivers at least one readable field for
 * this caller (403/404/no fields = nothing rendered; the server decides who sees what, nothing is gated by guessing roles
 * here). Field picker, status filter (`Fehlt` needs a field), "expiring" window 30/90/180 days, paging; a tap opens the
 * read-only member sheet. Read-only: catalog and definitions are maintained on the website. No notifications (Wave 9).
 * Values stay in hook state; nothing is logged, cached or persisted.
 */
export default function CredentialOverview({ clubId }: { clubId: string }) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState<OverviewQuery>(DEFAULT_OVERVIEW_QUERY);
  const { response, fields, hidden, failure, loading, reload } = useCredentialOverview(clubId, query);

  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);
  const [member, setMember] = useState<ClubMember | null>(null);
  const openSeq = useRef(0);
  // A club switch drops an open sheet / pending open (the parent keys this component per club, this is the second guard).
  useEffect(
    () => () => {
      openSeq.current++;
    },
    [],
  );

  const openMember = useCallback(
    async (clubMemberId: string) => {
      const id = ++openSeq.current;
      setOpening(clubMemberId);
      setOpenError(false);
      try {
        const res = await apiFetch<{ data: ClubMember }>(`/club-members/${encodeURIComponent(clubMemberId)}?clubId=${encodeURIComponent(clubId)}`);
        if (id !== openSeq.current) return;
        setMember(res.data);
      } catch {
        if (id === openSeq.current) setOpenError(true);
      } finally {
        if (id === openSeq.current) setOpening(null);
      }
    },
    [clubId],
  );

  if (hidden) return null;
  // Unknown until the first answer: render nothing so plain members never see a flash.
  if (!fields && (loading || !failure)) return null;
  if (fields && fields.length === 0) return null;

  const set = (patch: Partial<OverviewQuery>) => setQuery((q) => ({ ...q, page: 1, ...patch }));
  const total = response?.total ?? 0;
  const pages = overviewPageCount(total, response?.pageSize ?? OVERVIEW_PAGE_SIZE);
  const filtersActive = query.fieldKey !== null || query.status !== null;
  const selectedField = fields?.find((f) => f.key === query.fieldKey) ?? null;
  const formatDate = (v: string) => formatCredentialDate(v, language);

  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        className="flex-row items-center justify-between"
        style={{ minHeight: 44 }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${t('forms.cred.overview.title')}. ${t('forms.cred.overview.toggle')}`}
      >
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base" accessibilityRole="header">
          {t('forms.cred.overview.title')}
        </Text>
        {expanded ? <ChevronUp size={20} color={colors.mutedForeground} /> : <ChevronDown size={20} color={colors.mutedForeground} />}
      </TouchableOpacity>

      {expanded ? (
        <View className="mt-2">
          <Text className={`${mutedClass} mb-3`}>{t('forms.cred.overview.hint')}</Text>

          {fields ? (
            <>
              <Text className={`${mutedClass} font-semibold mb-1`}>{t('forms.cred.overview.field')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                <Chip
                  label={t('forms.cred.overview.field.all')}
                  selected={query.fieldKey === null}
                  onPress={() => set({ fieldKey: null, status: query.status === 'missing' ? null : query.status })}
                />
                {fields.map((f) => (
                  <Chip key={f.id} label={f.label} locked={f.sensitive} selected={query.fieldKey === f.key} onPress={() => set({ fieldKey: query.fieldKey === f.key ? null : f.key, status: query.fieldKey === f.key && query.status === 'missing' ? null : query.status })} />
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text className={`${mutedClass} font-semibold mt-3 mb-1`}>{t('forms.cred.overview.status')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
            <Chip label={t('forms.cred.overview.status.all')} selected={query.status === null} onPress={() => set({ status: null })} />
            {OVERVIEW_STATUSES.map((s: OverviewStatus) => (
              <Chip
                key={s}
                label={t(`forms.cred.overview.status.${s}`)}
                selected={query.status === s}
                disabled={s === 'missing' && !query.fieldKey}
                onPress={() => set({ status: query.status === s ? null : s })}
              />
            ))}
          </ScrollView>
          {!query.fieldKey ? <Text className={`${mutedClass} mt-1`}>{t('forms.cred.overview.missingNeedsField')}</Text> : null}

          <Text className={`${mutedClass} font-semibold mt-3 mb-1`}>{t('forms.cred.overview.within')}</Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {WITHIN_DAYS_OPTIONS.map((d) => (
              <Chip key={d} label={t('forms.cred.overview.within.option', { days: d })} selected={query.withinDays === d} onPress={() => set({ withinDays: d })} />
            ))}
          </View>

          <View className="mt-4">
            {loading ? (
              <View className="py-8 items-center" accessibilityLabel={t('forms.cred.overview.loading')}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : failure ? (
              <View>
                <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
                  {failure === 'notFound' ? t('forms.cred.overview.errorNotFound') : t('forms.cred.overview.error')}
                </Text>
                <TouchableOpacity
                  onPress={() => (failure === 'notFound' ? set({ fieldKey: null, status: query.status === 'missing' ? null : query.status }) : void reload())}
                  className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
                  style={{ minHeight: 44 }}
                  accessibilityRole="button"
                >
                  <Text className="text-primary dark:text-primary-dark text-sm font-bold">{failure === 'notFound' ? t('forms.cred.overview.reset') : t('verein.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : response && response.data.length === 0 ? (
              <View>
                <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-2">
                  {filtersActive ? t('forms.cred.overview.empty') : t('forms.cred.overview.emptyAll')}
                </Text>
                {filtersActive ? (
                  <TouchableOpacity
                    onPress={() => set({ fieldKey: null, status: null })}
                    className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
                    style={{ minHeight: 44 }}
                    accessibilityRole="button"
                  >
                    <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('forms.cred.overview.reset')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : response ? (
              <View>
                <Text className={`${mutedClass} mb-2`} accessibilityLiveRegion="polite">
                  {t('forms.cred.overview.count', { total })}
                </Text>
                {response.data.map((row) => {
                  const rowField = response.fields.find((f) => f.key === row.fieldKey) ?? selectedField;
                  const summary = credentialSummary(row.value, rowField?.options ?? null, {
                    yes: '',
                    level: (level) => t('forms.cred.summary.level', { level }),
                    obtained: (date) => t('forms.cred.summary.obtained', { date }),
                    until: (date) => t('forms.cred.summary.until', { date }),
                    formatDate,
                  });
                  // `yes` is not part of the line here (the badge and the field name already say it): drop the leading separator.
                  const detail = summary ? summary.replace(/^, /, '') : null;
                  const name = row.displayName ?? '—';
                  return (
                    <TouchableOpacity
                      key={`${row.clubMemberId}|${row.fieldKey}`}
                      onPress={() => void openMember(row.clubMemberId)}
                      disabled={opening !== null}
                      className="border border-border dark:border-border-dark rounded-xl p-3 mb-2"
                      style={{ minHeight: 44 }}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('forms.cred.overview.open', { name, field: row.fieldLabel })}${row.sensitive ? `, ${t('forms.cf.sensitive')}` : ''}`}
                    >
                      <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                        <Text className="flex-1 text-foreground dark:text-foreground-dark font-bold text-sm">{name}</Text>
                        {opening === row.clubMemberId ? <ActivityIndicator color={colors.primary} accessibilityLabel={t('forms.cred.overview.opening')} /> : null}
                      </View>
                      <View className="flex-row items-center flex-wrap mt-0.5" style={{ gap: 6 }}>
                        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">{row.fieldLabel}</Text>
                        {row.sensitive ? (
                          <View className="flex-row items-center" style={{ gap: 3 }}>
                            <Lock size={12} color={colors.mutedForeground} />
                            <Text className={mutedClass}>{t('forms.cf.sensitive')}</Text>
                          </View>
                        ) : null}
                      </View>
                      {/* Plain text: values are member input. */}
                      <Text className={`${mutedClass} mt-1`}>{row.expiry.status === 'missing' ? t('forms.cred.overview.missingRow') : (detail ?? '')}</Text>
                      <View className="mt-1.5">
                        <ExpiryBadge expiry={row.expiry} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {openError ? (
                  <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
                    {t('forms.cred.overview.openError')}
                  </Text>
                ) : null}
                {pages > 1 ? (
                  <View className="flex-row items-center justify-between mt-1" style={{ gap: 8 }}>
                    <Chip label={t('forms.cred.overview.prev')} selected={false} disabled={query.page <= 1} onPress={() => setQuery((q) => ({ ...q, page: Math.max(1, q.page - 1) }))} />
                    <Text className={mutedClass} accessibilityLiveRegion="polite">
                      {t('forms.cred.overview.page', { page: response.page, pages })}
                    </Text>
                    <Chip label={t('forms.cred.overview.next')} selected={false} disabled={query.page >= pages} onPress={() => setQuery((q) => ({ ...q, page: q.page + 1 }))} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <MemberDetailSheet member={member} onClose={() => setMember(null)} clubId={clubId} />
    </View>
  );
}
