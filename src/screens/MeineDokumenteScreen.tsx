import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { Body, Card, Loading } from '@/components/assembly/ui';
import ChipSelector from '@/components/documents/ChipSelector';
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

  const handleGone = useCallback(() => {
    void reloadWards();
  }, [reloadWards]);

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
        <ChipSelector chips={subjects} selectedKey={selected?.key ?? null} onSelect={setChoice} />
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
            onGone={handleGone}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
