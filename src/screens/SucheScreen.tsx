import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useThemeColors } from '@/theme/colors';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useClubSearch } from '@/hooks/useToday';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import { CalendarDays, CircleX, FileText, MapPin, Search, SearchX, Users } from 'lucide-react-native';
import type { RootStackParamList } from '@/navigation/AppNavigator';

/**
 * Club-wide search (Wave 14): members, events, documents and places in one box. The server returns only the groups the
 * person may see (members follow the member list's privacy rules, documents the folder rights), so a group that is not
 * in the answer is simply not shown. The search text is sent to the club's search route and nowhere else.
 */
export default function SucheScreen() {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeClub } = useMyClubs();
  const [query, setQuery] = useState('');
  const { results, error, loading, retry, tooShort } = useClubSearch(activeClub?.clubId ?? null, query);

  const total = results ? (results.members?.length ?? 0) + results.events.length + results.documents.length + results.locations.length : 0;
  const when = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    // The stack header says "Suche"; the field is the first thing on the screen and takes the focus.
    <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center bg-muted dark:bg-muted-dark rounded-[10px] pl-3" style={{ minHeight: 44, gap: 8 }}>
          <Search size={20} strokeWidth={1.75} color={themeColors.mutedForeground} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={themeColors.mutedForeground}
            accessibilityLabel={t('search.input-label')}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            className="flex-1 text-foreground dark:text-foreground-dark text-[17px]"
            style={{ minHeight: 44 }}
          />
          {query.length > 0 ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('search.clear')} onPress={() => setQuery('')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <CircleX size={20} strokeWidth={1.75} color={themeColors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-1.5 px-1">{tooShort ? t('search.too-short') : t('search.hint')}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}>
        {!activeClub ? (
          <EmptyState title={t('search.no-club')} />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} />
        ) : loading ? (
          <Skeleton shape="rows" lines={4} />
        ) : results && total === 0 ? (
          <EmptyState icon={SearchX} title={t('search.empty.for', { query: query.trim() })} hint={t('search.empty.body')} action={<Button variant="secondary" label={t('search.empty.action')} onPress={() => setQuery('')} />} />
        ) : results ? (
          <>
            {results.members && results.members.length > 0 ? (
              <ListSection title={t('search.group.members')} inset={60}>
                {results.members.map((m) => (
                  <ListRow key={m.id} icon={Users} title={m.name} hint={m.departmentNames?.join(', ')} onPress={() => navigation.navigate('Verein', { tab: 'mitglieder', memberId: m.id })} />
                ))}
              </ListSection>
            ) : null}
            {results.events.length > 0 ? (
              <ListSection title={t('search.group.events')} inset={60}>
                {results.events.map((e) => (
                  <ListRow key={e.id} icon={CalendarDays} title={e.title} hint={when(e.startsAt)} onPress={() => navigation.navigate('Kalender', { tab: 'termine', eventId: e.id })} />
                ))}
              </ListSection>
            ) : null}
            {results.documents.length > 0 ? (
              <ListSection title={t('search.group.documents')} inset={60}>
                {results.documents.map((d) => (
                  <ListRow key={d.id} icon={FileText} title={d.title} onPress={() => navigation.navigate('Archiv')} />
                ))}
              </ListSection>
            ) : null}
            {results.locations.length > 0 ? (
              <ListSection title={t('search.group.locations')} inset={60}>
                {results.locations.map((l) => (
                  <ListRow key={l.id} icon={MapPin} title={l.name} onPress={() => navigation.navigate('Standorte', { tab: 'orte', locationId: l.id })} />
                ))}
              </ListSection>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
