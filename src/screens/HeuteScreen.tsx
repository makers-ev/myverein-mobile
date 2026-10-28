import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useWards } from '@/hooks/useWards';
import { useWardContacts, useWardEvents } from '@/hooks/useWardToday';
import { isNotFound } from '@/lib/ward';
import WardSwitcher from '@/components/guardian/WardSwitcher';
import AbsenceSection from '@/components/privacy/AbsenceSection';
import ConsentsSection from '@/components/privacy/ConsentsSection';
import WardEventsSection from '@/components/guardian/WardEventsSection';
import { AcknowledgementsEntry, MyCardEntry, MyDocumentsEntry } from '@/components/documents/DocumentsEntry';
import WardContactsSection from '@/components/guardian/WardContactsSection';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Heute'>;

/**
 * Guardian view "Heute" (Wave 10 M1): the linked child's events of the next 14 days with Zu-/Absage, and the trainers'
 * contact ways. Everything is bound to the selected ward and only reachable through `/my-wards`; the nav entry exists
 * only for accounts with wards. A 404 on a ward route means the link ended (e.g. the child came of age): the list is
 * reloaded and a notice shown. No child data is logged or stored.
 */
export default function HeuteScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { wards, selected, select, loading, error, reload } = useWards();
  const events = useWardEvents(selected?.clubId ?? null, selected?.wardId ?? null);
  const contacts = useWardContacts(selected?.clubId ?? null, selected?.wardId ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [goneNotice, setGoneNotice] = useState(false);

  // A 404 on any ward route (events, contacts, consents, absences) means the link ended: reload the wards, tell the person.
  const handleGone = useCallback(() => {
    void reload().then(() => setGoneNotice(true));
  }, [reload]);
  const gone = isNotFound(events.error) || isNotFound(contacts.error);
  useEffect(() => {
    if (gone) handleGone();
  }, [gone, handleGone]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reload(), events.reload(), contacts.reload()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4">
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
          {t('heute.title')}
        </Text>
        {selected ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-2" numberOfLines={1}>
            {[selected.firstName ?? selected.name, selected.clubName].filter(Boolean).join(' - ')}
          </Text>
        ) : null}
        <WardSwitcher wards={wards} selected={selected} onSelect={(key) => {
            setGoneNotice(false);
            select(key);
          }} />
      </View>

      {loading && wards.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : !selected ? (
        <View className="px-6 pt-6">
          {error ? (
            <>
              <Text className="text-destructive text-sm mb-2">{t('heute.load-error')}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} className="min-h-[44px] justify-center self-start">
                <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {goneNotice ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('heute.gone')}</Text> : null}
              <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('heute.empty.title')}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('heute.empty.body')}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Dashboard')} className="min-h-[44px] justify-center self-start">
                <Text className="text-primary dark:text-primary-dark font-semibold">{t('heute.empty.dashboard')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <ScrollView
          key={`${selected.clubId}:${selected.wardId}`}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={themeColors.primary} />}
        >
          {goneNotice ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{t('heute.gone')}</Text> : null}
          <AbsenceSection subject={{ kind: 'ward', clubId: selected.clubId, wardId: selected.wardId }} wardName={selected.firstName ?? selected.name} canReport={selected.canReportAbsence} onGone={handleGone} />
          <WardEventsSection ward={selected} events={events} />
          <ConsentsSection
            subject={{ kind: 'ward', clubId: selected.clubId, wardId: selected.wardId, canConsent: selected.canConsent }}
            wardName={selected.firstName ?? selected.name}
            onChanged={() => void reload()}
            onGone={handleGone}
          />
          <WardContactsSection contacts={contacts} />
          <MyCardEntry forChild />
          <AcknowledgementsEntry clubId={selected.clubId} />
          <MyDocumentsEntry />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
