import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { Body, Card, Loading } from '@/components/assembly/ui';
import MemberDocumentsList from '@/components/documents/MemberDocumentsList';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useWards } from '@/hooks/useWards';
import { isOwnClub, wardKey } from '@/lib/ward';

const SELF = 'self';

/**
 * "Meine Dokumente" (Wave 13 M4): the personal storage of the caller in the active club and, for guardians, one chip per
 * child. Opening a document is two taps (row, then the viewer app). Receipts, confirmations and board-added papers are
 * listed; uploading, hiding and deleting stay on the website. What a person may see is decided by the backend (own
 * storage, live guardian link): this screen only offers the subjects it knows, there is no permission to gate on.
 */
export default function MeineDokumenteScreen() {
  const { t } = useLanguage();
  const { activeClub, loading: clubLoading } = useActiveClub();
  const { wards, loading: wardsLoading, reload: reloadWards } = useWards();
  const [choice, setChoice] = useState<string>(SELF);
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const ownClub = activeClub && isOwnClub(activeClub) ? activeClub : null;
  const subjects = [
    ...(ownClub ? [{ key: SELF, label: t('mydocs.own'), sub: ownClub.clubName }] : []),
    ...wards.map((w) => ({ key: wardKey(w), label: w.firstName ?? w.name, sub: w.clubName })),
  ];
  const selected = subjects.find((s) => s.key === choice) ?? subjects[0] ?? null;
  const ward = selected && selected.key !== SELF ? wards.find((w) => wardKey(w) === selected.key) ?? null : null;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reloadWards();
      setVersion((v) => v + 1);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('mydocs.title')}
        </Text>
        {selected ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-2" numberOfLines={1}>
            {ward ? t('mydocs.child-title', { name: selected.label }) : selected.sub}
          </Text>
        ) : null}
        {subjects.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {subjects.map((s) => {
              const active = s.key === selected?.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  accessibilityLabel={`${s.label}, ${s.sub}`}
                  onPress={() => setChoice(s.key)}
                  className={`rounded-2xl px-4 justify-center border ${active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'bg-card dark:bg-card-dark border-border dark:border-border-dark'}`}
                  style={{ minHeight: 48 }}
                >
                  <Text className={`text-sm font-bold ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text className={`text-xs ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`} numberOfLines={1}>
                    {s.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        {clubLoading || (wardsLoading && wards.length === 0) ? (
          <Loading />
        ) : !selected ? (
          <Card>
            <Body muted>{t('mydocs.no-club')}</Body>
          </Card>
        ) : (
          <MemberDocumentsList
            key={`${selected.key}:${version}`}
            subject={ward ? { kind: 'ward', clubId: ward.clubId, wardId: ward.wardId } : { kind: 'self', clubId: ownClub!.clubId }}
            wardName={ward ? (ward.firstName ?? ward.name) : null}
            onGone={() => void reloadWards()}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
