import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react-native';

import { useActiveClub } from '@/clubs/ActiveClubProvider';
import AcknowledgementDetailView from '@/components/acknowledgements/AcknowledgementDetailView';
import { Body, Card, ErrorRetry, Loading } from '@/components/assembly/ui';
import ChipSelector, { type Chip } from '@/components/documents/ChipSelector';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useAcknowledgements } from '@/hooks/useAcknowledgements';
import { useWards } from '@/hooks/useWards';
import { splitAcknowledgements, type AcknowledgementStatus, type MyAcknowledgement } from '@/lib/acknowledgements';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { formatDocumentDate } from '@/lib/documents';
import { isOwnClub } from '@/lib/ward';
import { useThemeColors } from '@/theme/colors';

const STATUS_KEY: Record<AcknowledgementStatus, string> = { offen: 'ack.status.offen', bestaetigt: 'ack.status.bestaetigt', abgelehnt: 'ack.status.abgelehnt', abgelaufen: 'ack.status.abgelaufen' };

function StatusIcon({ status }: { status: AcknowledgementStatus }) {
  const colors = useThemeColors();
  if (status === 'bestaetigt') return <CheckCircle2 size={20} color={colors.primary} />;
  if (status === 'abgelehnt') return <XCircle size={20} color={colors.mutedForeground} />;
  if (status === 'abgelaufen') return <Clock size={20} color={colors.mutedForeground} />;
  return <Circle size={20} color={colors.primary} />;
}

function Row({ item, isLast, onPress }: { item: MyAcknowledgement; isLast: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  const meta = [item.relation === 'guardian' ? item.personName : null, t(STATUS_KEY[item.status]), item.dueAt && item.status === 'offen' ? t('ack.due', { date: formatDocumentDate(item.dueAt) }) : null].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.documentTitle}. ${meta}`}
      className={`flex-row items-center py-3 ${isLast ? '' : 'border-b border-border dark:border-border-dark'}`}
      style={{ minHeight: 56, gap: 12 }}
    >
      <StatusIcon status={item.status} />
      <View className="flex-1">
        <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold" numberOfLines={2}>
          {item.documentTitle}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-0.5" numberOfLines={2}>
          {meta}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** One club's requests: open ones first, then answered/expired; a tap opens the detail (read, answer, proof). */
function ClubAcknowledgements({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { items, loading, error, reload } = useAcknowledgements(clubId);
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

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      {loading && !items ? (
        <Loading />
      ) : !items ? (
        <ErrorRetry message={apiErrorMessage(error, t, 'ack.error.load')} onRetry={() => void reload()} />
      ) : selected ? (
        <AcknowledgementDetailView clubId={clubId} item={selected} onChanged={() => void reload()} onBack={() => setSelectedId(null)} />
      ) : items.length === 0 ? (
        <Card>
          <Body muted>{t('ack.empty')}</Body>
        </Card>
      ) : (
        <>
          <Card title={t('ack.open')}>
            {open.length === 0 ? <Body muted>{t('ack.none-open')}</Body> : open.map((a, i) => <Row key={a.id} item={a} isLast={i === open.length - 1} onPress={() => setSelectedId(a.id)} />)}
          </Card>
          {done.length > 0 ? (
            <Card title={t('ack.done')}>
              {done.map((a, i) => (
                <Row key={a.id} item={a} isLast={i === done.length - 1} onPress={() => setSelectedId(a.id)} />
              ))}
            </Card>
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
      <View className="px-6 pt-4">
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('ack.title')}
        </Text>
        <ChipSelector chips={chips} selectedKey={selected?.key ?? null} onSelect={setChoice} />
      </View>
      {clubLoading ? (
        <Loading />
      ) : !selected ? (
        <View className="px-6 pt-3">
          <Card>
            <Body muted>{t('mydocs.no-club')}</Body>
          </Card>
        </View>
      ) : (
        <ClubAcknowledgements key={selected.key} clubId={selected.key} />
      )}
    </SafeAreaView>
  );
}
