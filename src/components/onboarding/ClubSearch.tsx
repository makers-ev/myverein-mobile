import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useClubSearch } from '@/hooks/useClubSearch';
import { MIN_CLUB_SEARCH_LENGTH, type ClubSearchHit } from '@/lib/outreach';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import SignedImage from '@/components/ui/SignedImage';

interface Props {
  /** A tapped hit: the screen opens that club's application (the club code is public, the hit carries it). */
  onSelect: (hit: ClubSearchHit) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Club logo (signed URL via the media layer, never a raw link) with the initials as fallback (decorative: the name stands next to it). */
function HitLogo({ hit }: { hit: ClubSearchHit }) {
  const initials = <Avatar name={hit.name} size="M" tone="accent" />;
  if (!hit.logoUrl) return initials;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="rounded-full overflow-hidden" style={{ width: 40, height: 40 }}>
      <SignedImage uri={hit.logoUrl} style={{ width: 40, height: 40 }} fallback={initials} />
    </View>
  );
}

/**
 * "Verein finden" (Wave 15 M2): a search field and the hits as one `ListSection` (logo, name, place). Only clubs that
 * opted in to being found are returned by the server, so an empty result never says why (no enumeration hint): the
 * text points to the club code instead. One tap on a hit opens the application.
 */
export default function ClubSearch({ onSelect, disabled, autoFocus }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const { phase, hits, error, tooShort, retry } = useClubSearch(query);

  return (
    <View>
      <Text className="text-[13px] leading-[18px] font-medium mb-1.5 text-muted-foreground dark:text-muted-foreground-dark">{t('join-club.search.label')}</Text>
      <View className="flex-row items-center bg-muted dark:bg-muted-dark rounded-control px-3" style={{ minHeight: 48, gap: 8 }}>
        <Search size={20} strokeWidth={1.75} color={colors.mutedForeground} />
        <TextInput
          className="flex-1 text-foreground dark:text-foreground-dark text-[17px]"
          style={{ minHeight: 48 }}
          accessibilityLabel={t('join-club.search.label')}
          accessibilityHint={t('join-club.search.hint', { min: MIN_CLUB_SEARCH_LENGTH })}
          placeholder={t('join-club.search.placeholder')}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
          editable={!disabled}
          value={query}
          onChangeText={setQuery}
        />
        {phase === 'loading' ? <ActivityIndicator size="small" color={colors.primaryText} accessibilityLabel={t('join-club.search.loading')} /> : null}
      </View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-2 px-1">{t('join-club.search.hint', { min: MIN_CLUB_SEARCH_LENGTH })}</Text>

      <View className="mt-4" accessibilityLiveRegion="polite">
        {phase === 'error' ? (
          <ErrorState error={error} fallbackKey="join-club.search.error" onRetry={retry} />
        ) : phase === 'done' && hits.length === 0 ? (
          <EmptyState icon={Search} title={t('join-club.search.empty.title')} hint={t('join-club.search.empty.hint')} />
        ) : hits.length > 0 ? (
          <ListSection inset={68}>
            {hits.map((hit) => (
              <ListRow
                key={hit.slug}
                leading={<HitLogo hit={hit} />}
                title={hit.name}
                hint={hit.city ?? undefined}
                accessibilityHint={t('join-club.search.hit', { name: hit.name })}
                onPress={disabled ? undefined : () => onSelect(hit)}
              />
            ))}
          </ListSection>
        ) : null}
      </View>
    </View>
  );
}
