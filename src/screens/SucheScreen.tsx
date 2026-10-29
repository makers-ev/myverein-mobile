import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useClubSearch } from '@/hooks/useToday';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';
import ListRow from '@/components/ui/ListRow';
import type { RootStackParamList } from '@/navigation/AppNavigator';

/**
 * Club-wide search (Wave 14): members, events, documents and places in one box. The server returns only the groups the
 * person may see (members follow the member list's privacy rules, documents the folder rights), so a group that is not
 * in the answer is simply not shown. The search text is sent to the club's search route and nowhere else.
 */
export default function SucheScreen() {
  const { t, language } = useLanguage();
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
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-6 pt-4 pb-2">
        <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-3">
          {t('search.title')}
        </Text>
        <View className="flex-row items-center bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl px-3" style={{ minHeight: 48 }}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor="#6b7280"
            accessibilityLabel={t('search.input-label')}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            className="flex-1 text-foreground dark:text-foreground-dark text-base"
            style={{ minHeight: 44 }}
          />
          {query.length > 0 ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('search.clear')} onPress={() => setQuery('')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-lg">×</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{tooShort ? t('search.too-short') : t('search.hint')}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
        {!activeClub ? (
          <EmptyState title={t('search.no-club')} />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} />
        ) : loading ? (
          <Skeleton lines={4} />
        ) : results && total === 0 ? (
          <EmptyState title={t('search.empty.title')} hint={t('search.empty.body')} action={<Button variant="secondary" label={t('search.empty.action')} onPress={() => navigation.navigate('Kalender')} />} />
        ) : results ? (
          <>
            {results.members && results.members.length > 0 ? (
              <Group title={t('search.group.members')}>
                {results.members.map((m) => (
                  <ListRow key={m.id} title={m.name} hint={m.departmentNames?.join(', ')} onPress={() => navigation.navigate('Verein', { tab: 'mitglieder' })} />
                ))}
              </Group>
            ) : null}
            {results.events.length > 0 ? (
              <Group title={t('search.group.events')}>
                {results.events.map((e) => (
                  <ListRow key={e.id} title={e.title} hint={when(e.startsAt)} onPress={() => navigation.navigate('Kalender', { tab: 'termine', eventId: e.id })} />
                ))}
              </Group>
            ) : null}
            {results.documents.length > 0 ? (
              <Group title={t('search.group.documents')}>
                {results.documents.map((d) => (
                  <ListRow key={d.id} title={d.title} onPress={() => navigation.navigate('Archiv')} />
                ))}
              </Group>
            ) : null}
            {results.locations.length > 0 ? (
              <Group title={t('search.group.locations')}>
                {results.locations.map((l) => (
                  <ListRow key={l.id} title={l.name} onPress={() => navigation.navigate('Standorte', { tab: 'orte' })} />
                ))}
              </Group>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-2">
      <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-bold uppercase tracking-wider mb-2 mt-3">
        {title}
      </Text>
      {children}
    </View>
  );
}
