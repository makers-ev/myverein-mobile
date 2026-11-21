import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, Handshake, Mail, MapPin, Phone } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useExternalAccess } from '@/external/ExternalAccessProvider';
import { usePublicClub } from '@/hooks/usePublicClub';
import { formatDay, formatInstant, safeWebLink, type Sponsor } from '@/lib/outreach';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import HeroCard from '@/components/ui/HeroCard';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Skeleton from '@/components/ui/Skeleton';
import Surface from '@/components/ui/Surface';
import OrgLogo from '@/components/outreach/OrgLogo';
import { SponsorFacts } from '@/components/outreach/SponsorFacts';
import ClubSwitcher from '@/components/verein/ClubSwitcher';

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** Hero of the sponsor's own partnership: status and term at a glance. */
function SponsorHero({ sponsor }: { sponsor: Sponsor }) {
  const { t, language } = useLanguage();
  const to = formatDay(sponsor.endsOn, language);
  return (
    <HeroCard
      tone="primary"
      eyebrow={`${t('partner.hero.eyebrow')} · ${t(`sponsors.status.${sponsor.status}`)}`}
      title={sponsor.name}
      meta={to ? t('sponsors.period.until', { date: to }) : t('sponsors.period.open')}
    />
  );
}

/**
 * Reduced start screen of the external role `sponsor` (Wave 15 M1, Navbar tab "Heute"): the account's own sponsor entry
 * (`GET /external/me`: term, Gegenleistung, contacts, never internal notes) and the club's public information
 * (`GET /public/clubs/:slug`, only what the club released). No member data, no club navigation: the server answers 403
 * for everything else. Empty, loading and error states are designed; logos only through `OrgLogo`.
 */
export default function PartnerScreen() {
  const { t, language } = useLanguage();
  const { me, loading, error, reload } = useExternalAccess();
  const pub = usePublicClub(me?.clubSlug ?? null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), pub.reload()]);
    setRefreshing(false);
  };

  const sponsors = me?.sponsors ?? [];
  const info = pub.info;
  const website = safeWebLink(info?.website);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />} contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader title={t('partner.title')} context={me ? <ClubSwitcher /> : undefined} />
        <View className="px-4">
          {error && !me ? (
            <ErrorState fallbackKey="partner.error" onRetry={() => void reload()} />
          ) : loading || !me ? (
            <Skeleton shape="hero" />
          ) : (
            <>
              {sponsors.length === 0 ? (
                <EmptyState icon={Handshake} title={t('partner.empty.title')} hint={t('partner.empty.hint')} />
              ) : (
                sponsors.map((s, i) => (
                  <View key={s.id} className="mb-6">
                    {i === 0 ? <SponsorHero sponsor={s} /> : null}
                    <Surface className="p-4 mt-4" style={{ gap: 14 }}>
                      <View className="flex-row items-center" style={{ gap: 12 }}>
                        <OrgLogo name={s.name} uri={s.logoUrl} size={72} onExpired={() => void reload()} />
                        <Text accessibilityRole="header" className="flex-1 text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold">{s.name}</Text>
                      </View>
                      <SponsorFacts sponsor={s} />
                    </Surface>
                    {s.contacts.length > 0 ? (
                      <View className="mt-4">
                        <ListSection title={t('sponsors.detail.contacts')} inset={16}>
                          {s.contacts.map((c) => (
                            <ListRow key={c.id} title={c.name} hint={[c.role, c.email, c.phone].filter(Boolean).join(' · ') || undefined} />
                          ))}
                        </ListSection>
                      </View>
                    ) : null}
                  </View>
                ))
              )}

              <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold mb-3">{t('partner.section.club')}</Text>
              {pub.loading && !info && !pub.missing ? (
                <Skeleton lines={3} />
              ) : pub.error && !info ? (
                <ErrorState error={pub.error} onRetry={() => void pub.reload()} />
              ) : (
                <>
                  <Surface className="p-4 mb-4" style={{ gap: 10 }}>
                    <View className="flex-row items-center" style={{ gap: 12 }}>
                      <OrgLogo name={info?.name ?? me.clubName} uri={info?.logoUrl} />
                      <View className="flex-1">
                        <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold">{info?.name ?? me.clubName}</Text>
                        {info?.tagline ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{info.tagline}</Text> : null}
                      </View>
                    </View>
                    {info?.description ? <Text selectable className="text-foreground dark:text-foreground-dark text-[15px] leading-[22px]">{info.description}</Text> : null}
                    {!info ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{t('partner.club.empty')}</Text> : null}
                  </Surface>
                  {info && (info.city || info.contactEmail || info.contactPhone || website) ? (
                    <ListSection inset={60}>
                      {info.city ? <ListRow key="city" icon={MapPin} title={[info.address, info.city].filter(Boolean).join(', ')} hint={t('partner.club.city')} /> : null}
                      {info.contactEmail ? <ListRow key="mail" icon={Mail} title={info.contactEmail} hint={t('partner.club.contact')} noChevron onPress={() => open(`mailto:${info.contactEmail}`)} accessibilityHint={t('sponsors.detail.mail', { value: info.contactEmail })} /> : null}
                      {info.contactPhone ? <ListRow key="tel" icon={Phone} title={info.contactPhone} hint={t('partner.club.contact')} noChevron onPress={() => open(`tel:${info.contactPhone!.replace(/\s+/g, '')}`)} accessibilityHint={t('sponsors.detail.call', { value: info.contactPhone })} /> : null}
                      {website ? <ListRow key="web" title={website} hint={t('partner.website')} noChevron onPress={() => open(website)} accessibilityHint={t('sponsors.detail.website.open')} /> : null}
                    </ListSection>
                  ) : null}
                  {info && info.events.length > 0 ? (
                    <ListSection title={t('partner.club.events')} inset={60}>
                      {info.events.slice(0, 3).map((e, i) => (
                        <ListRow key={`${e.startsAt}-${i}`} icon={CalendarDays} title={e.title} hint={[formatInstant(e.startsAt, language), e.locationName].filter(Boolean).join(' · ')} />
                      ))}
                    </ListSection>
                  ) : null}
                </>
              )}
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] px-1">{t('partner.note')}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
