import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import { Body, Card, Loading } from '@/components/assembly/ui';
import ChipSelector, { type Chip } from '@/components/documents/ChipSelector';
import MemberCardPanel from '@/components/memberCard/MemberCardPanel';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useWards } from '@/hooks/useWards';
import { isOwnClub, wardKey } from '@/lib/ward';

const SELF = 'self';

/**
 * "Mein Ausweis" (Wave 13 M6): the digital membership card of the caller in the active own club and, for guardians, the
 * card of each child (chips). Shown at full width with a high-contrast QR; works offline from the device copy (see
 * `useMemberCard`). Which cards exist is decided by the backend (own card, live guardian link), nothing to gate on here.
 */
export default function MitgliedsausweisScreen() {
  const { t } = useLanguage();
  const { activeClub, loading: clubLoading } = useActiveClub();
  const { wards, loading: wardsLoading, reload: reloadWards } = useWards();
  const [choice, setChoice] = useState<string>(SELF);
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const ownClub = activeClub && isOwnClub(activeClub) ? activeClub : null;
  const chips = useMemo<Chip[]>(
    () => [
      ...(ownClub ? [{ key: SELF, label: t('card.own'), sub: ownClub.clubName }] : []),
      ...wards.map((w) => ({ key: wardKey(w), label: w.firstName ?? w.name, sub: w.clubName })),
    ],
    [ownClub, wards, t],
  );
  const selected = chips.find((c) => c.key === choice) ?? chips[0] ?? null;
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
          {ward ? t('card.child-title', { name: selected?.label ?? '' }) : t('card.screen-title')}
        </Text>
        <ChipSelector chips={chips} selectedKey={selected?.key ?? null} onSelect={setChoice} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        {clubLoading || (wardsLoading && wards.length === 0) ? (
          <Loading />
        ) : !selected ? (
          <Card>
            <Body muted>{t('mydocs.no-club')}</Body>
          </Card>
        ) : (
          <MemberCardPanel
            key={`${selected.key}:${version}`}
            subject={ward ? { kind: 'ward', clubId: ward.clubId, wardId: ward.wardId } : { kind: 'self', clubId: ownClub!.clubId }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
