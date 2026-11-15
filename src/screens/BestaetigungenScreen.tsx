import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FileCheck } from 'lucide-react-native';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import AcknowledgementDetailView from '@/components/acknowledgements/AcknowledgementDetailView';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import HeroCard from '@/components/ui/HeroCard';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import Skeleton from '@/components/ui/Skeleton';
import ChipSelector, { type Chip } from '@/components/documents/ChipSelector';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useAcknowledgements } from '@/hooks/useAcknowledgements';
import { useWards } from '@/hooks/useWards';
import { splitAcknowledgements, type AcknowledgementStatus, type MyAcknowledgement } from '@/lib/acknowledgements';
import { formatDocumentDate } from '@/lib/documents';
import { isOwnClub } from '@/lib/ward';

const STATUS_KEY: Record<AcknowledgementStatus, string> = { offen: 'ack.status.offen', bestaetigt: 'ack.status.bestaetigt', abgelehnt: 'ack.status.abgelehnt', abgelaufen: 'ack.status.abgelaufen' };
const STATUS_TONE: Record<AcknowledgementStatus, BadgeTone> = { offen: 'warning', bestaetigt: 'success', abgelehnt: 'neutral', abgelaufen: 'warning' };

function Row({ item, onPress }: { item: MyAcknowledgement; onPress: () => void }) {
  const { t } = useLanguage();
  const open = item.status === 'offen';
  const meta = [item.relation === 'guardian' ? item.personName : null, open ? t(STATUS_KEY[item.status]) : null, item.dueAt && open ? t('ack.due', { date: formatDocumentDate(item.dueAt) }) : null].filter(Boolean).join(' · ');
  return (
    <ListRow
      title={item.documentTitle}
      hint={meta || undefined}
      trailing={open ? undefined : <Badge tone={STATUS_TONE[item.status]}>{t(STATUS_KEY[item.status])}</Badge>}
      noChevron={!open}
      onPress={onPress}
    />
  );
}

/** One club's requests: open ones first, then answered/expired; a tap opens the detail (read, answer, proof). */
function ClubAcknowledgements({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { items, loading, error, reload, hasMore, loadMore } = useAcknowledgements(clubId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { open, done } = useMemo(() => splitAcknowledgements(items ?? []), [items]);
  const selected = selectedId ? (items ?? []).find((a) => a.id === selectedId) ?? null : null;

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!selectedId) return false;
        setSelectedId(null);
        return true;
      });
      return () => sub.remove();
    }, [selectedId]),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  const first = open[0] ?? null;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      {loading && !items ? (
        <Skeleton shape="hero" />
      ) : !items ? (
        <ErrorState error={error} fallbackKey="ack.error.load" onRetry={() => void reload()} />
      ) : selected ? (
        <AcknowledgementDetailView clubId={clubId} item={selected} onChanged={() => void reload()} onBack={() => setSelectedId(null)} />
      ) : items.length === 0 ? (
        <EmptyState icon={FileCheck} title={t('ack.empty')} />
      ) : (
        <>
          {first ? (
            <View className="mb-6">
              <HeroCard
                eyebrow={[t(STATUS_KEY[first.status]), first.dueAt ? t('ack.due', { date: formatDocumentDate(first.dueAt) }) : null].filter(Boolean).join(' · ')}
                title={first.documentTitle}
                meta={first.relation === 'guardian' ? first.personName ?? undefined : undefined}
              >
                <Button variant="inverse" label={t('ack.hero.read')} onPress={() => setSelectedId(first.id)} />
              </HeroCard>
            </View>
          ) : null}
          <ListSection title={t('ack.open')}>
            {open.length === 0 ? <ListRow title={t('ack.none-open')} /> : open.map((a) => <Row key={a.id} item={a} onPress={() => setSelectedId(a.id)} />)}
          </ListSection>
          {error ? <ErrorState error={error} fallbackKey="ack.error.load" onRetry={() => (hasMore ? loadMore() : void reload())} /> : null}
          {hasMore ? (
            <View className="mb-6">
              <Button block variant="secondary" label={t('ack.more')} loading={loading} onPress={loadMore} />
            </View>
          ) : null}
          {done.length > 0 ? (
            <ListSection title={t('ack.done')}>
              {done.map((a) => (
                <Row key={a.id} item={a} onPress={() => setSelectedId(a.id)} />
              ))}
            </ListSection>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

/**
 * "Bestätigungen" (Wave 13 M5): requests to confirm that a document was read, for the own club and for the clubs of the
 * children a guardian acts for. Entry (<= 3 taps): Verein/Heute > Bestätigungen > request > "Ich bestätige". Which
 * requests exist and who may answer is decided by the backend (`canAnswer`); there is no permission to gate on.
 */
export default function BestaetigungenScreen() {
  const { t } = useLanguage();
  const { activeClub, loading: clubLoading } = useActiveClub();
  const { wards } = useWards();
  const [choice, setChoice] = useState<string | null>(null);

  const chips = useMemo<Chip[]>(() => {
    const out: Chip[] = [];
    if (activeClub && isOwnClub(activeClub)) out.push({ key: activeClub.clubId, label: activeClub.clubName ?? t('ack.own-club'), sub: t('ack.own') });
    for (const w of wards) if (!out.some((c) => c.key === w.clubId)) out.push({ key: w.clubId, label: w.clubName || t('ack.own-club'), sub: t('ack.child-of', { name: w.firstName ?? w.name }) });
    return out;
  }, [activeClub, wards, t]);
  const selected = chips.find((c) => c.key === choice) ?? chips[0] ?? null;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-4 pt-3">
        {/* The stack header names the screen (no second large title). */}
        <ChipSelector chips={chips} selectedKey={selected?.key ?? null} onSelect={setChoice} />
      </View>
      {clubLoading ? (
        <View className="px-4 pt-3">
          <Skeleton shape="hero" />
        </View>
      ) : !selected ? (
        <View className="px-4 pt-3">
          <EmptyState icon={FileCheck} title={t('mydocs.no-club')} />
        </View>
      ) : (
        <ClubAcknowledgements key={selected.key} clubId={selected.key} />
      )}
    </SafeAreaView>
  );
}
