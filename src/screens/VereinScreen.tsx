import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useClubInfo, type BoardMember, type Department } from '@/hooks/useClubInfo';
import { useClubMembers, type ClubMember } from '@/hooks/useClubMembers';
import { getDepartmentColor } from '@/theme/departmentColors';

type Tab = 'info' | 'mitglieder';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{title}</Text>
      {children}
    </View>
  );
}

// `last:` isn't reliable in NativeWind/React Native (no real DOM for a
// structural `:last-child` match) -- rows take an explicit `isLast` prop
// instead of relying on a CSS pseudo-class.
function BoardRow({ member, isLast }: { member: BoardMember; isLast: boolean }) {
  const { t } = useLanguage();
  return (
    <View className={`flex-row items-center justify-between py-2 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}>
      <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">{member.name ?? '—'}</Text>
      <View className="bg-primary/10 dark:bg-primary-dark/10 px-2.5 py-1 rounded-full">
        <Text className="text-primary dark:text-primary-dark text-xs font-semibold">
          {t(`verein.role.${member.roleType}`)}
        </Text>
      </View>
    </View>
  );
}

function DepartmentRow({ department, colorIndex, isLast }: { department: Department; colorIndex: number; isLast: boolean }) {
  const color = getDepartmentColor(colorIndex);
  return (
    <View className={`flex-row items-center py-2 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`} style={{ gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text className="text-foreground dark:text-foreground-dark text-sm">{department.name}</Text>
    </View>
  );
}

function VereinsinfoTab({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { info, loading } = useClubInfo(clubId);

  if (loading || !info) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <>
      <SectionCard title={t('verein.info.board')}>
        {info.board.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.info.board.empty')}</Text>
        ) : (
          info.board.map((m, i) => <BoardRow key={m.memberId} member={m} isLast={i === info.board.length - 1} />)
        )}
      </SectionCard>

      <SectionCard title={t('verein.info.departments')}>
        {info.departments.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.info.departments.empty')}</Text>
        ) : (
          info.departments.map((d, i) => (
            <DepartmentRow key={d.id} department={d} colorIndex={i} isLast={i === info.departments.length - 1} />
          ))
        )}
      </SectionCard>

      <SectionCard title={t('verein.info.pages')}>
        {info.pages.length === 0 ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.info.pages.empty')}</Text>
        ) : (
          info.pages.map((p, i) => (
            <View
              key={p.id}
              className={`py-2 ${i === info.pages.length - 1 ? '' : 'border-b border-border dark:border-border-dark'}`}
            >
              <Text className="text-foreground dark:text-foreground-dark text-sm font-medium">{p.title}</Text>
            </View>
          ))
        )}
      </SectionCard>
    </>
  );
}

function MemberRow({ member }: { member: ClubMember }) {
  const { t } = useLanguage();
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-3 mb-3">
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <Text className="flex-1 text-foreground dark:text-foreground-dark font-bold text-sm">{member.name ?? '—'}</Text>
        {member.category && (
          <View className="bg-muted dark:bg-muted-dark px-2 py-0.5 rounded-full">
            <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold">
              {t(`verein.category.${member.category}`)}
            </Text>
          </View>
        )}
      </View>
      {member.roles.length > 0 && (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
          {member.roles.map((r) => (
            <View key={r.id} className="bg-primary/10 dark:bg-primary-dark/10 px-2 py-0.5 rounded-full">
              <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t(`verein.role.${r.roleType}`)}</Text>
            </View>
          ))}
        </View>
      )}
      {member.joinedAt && (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">
          {t('verein.members.joined')}: {new Date(member.joinedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
}

function MitgliederTab({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { members, loading } = useClubMembers(clubId);

  if (loading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  if (members.length === 0) {
    return <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.members.empty')}</Text>;
  }

  return <>{members.map((m) => <MemberRow key={m.id} member={m} />)}</>;
}

export default function VereinScreen() {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [tab, setTab] = useState<Tab>('info');
  const { activeClub, loading: clubsLoading } = useMyClubs();

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {activeClub?.clubName ?? t('nav.verein')}
        </Text>
      </View>

      {clubsLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !activeClub ? (
        <View className="px-6 pt-6">
          <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('verein.no-club.title')}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.no-club.body')}</Text>
        </View>
      ) : (
        <>
          <View className="px-6 pt-3">
            <View className="flex-row mb-4" style={{ gap: 8 }}>
              {(['info', 'mitglieder'] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setTab(value)}
                  className={`px-4 py-2 rounded-full ${tab === value ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'}`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      tab === value ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'
                    }`}
                  >
                    {t(`verein.tab.${value}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
            {tab === 'info' ? <VereinsinfoTab clubId={activeClub.clubId} /> : <MitgliederTab clubId={activeClub.clubId} />}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
