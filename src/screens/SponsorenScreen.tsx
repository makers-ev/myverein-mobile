import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Handshake, Lock } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useMyClubs } from '@/hooks/useMyClubs';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import { useSponsors } from '@/hooks/useSponsors';
import { canSeeSponsors, formatDay, groupSponsors, type Sponsor } from '@/lib/outreach';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import FormSheet from '@/components/ui/FormSheet';
import ListRow from '@/components/ui/ListRow';
import ListSection from '@/components/ui/ListSection';
import Skeleton from '@/components/ui/Skeleton';
import OrgLogo from '@/components/outreach/OrgLogo';
import { SponsorFacts } from '@/components/outreach/SponsorFacts';
import { ContactList } from '@/components/outreach/ContactLines';
import NoClubChoices from '@/components/onboarding/NoClubChoices';
import ClubsLoadError from '@/components/verein/ClubsLoadError';

const STATUS_TONE: Record<Sponsor['status'], BadgeTone> = { aktiv: 'success', geplant: 'info', abgelaufen: 'neutral' };

/** One line under the name: "Aktiv · bis 31.12.2026". */
function periodHint(s: Sponsor, t: (k: string, p?: Record<string, string | number>) => string, language: string): string {
  const from = formatDay(s.startsOn, language);
  const to = formatDay(s.endsOn, language);
  const period = from && to ? t('sponsors.period.range', { from, to }) : to ? t('sponsors.period.until', { date: to }) : from ? t('sponsors.period.from', { date: from }) : t('sponsors.period.open');
  return `${t(`sponsors.status.${s.status}`)} · ${period}`;
}

function daysLeftLabel(s: Sponsor, t: (k: string, p?: Record<string, string | number>) => string): string | null {
  if (!s.expiringSoon || s.daysLeft === null) return null;
  if (s.daysLeft <= 0) return t('sponsors.days-left.today');
  return s.daysLeft === 1 ? t('sponsors.days-left.one') : t('sponsors.days-left', { count: s.daysLeft });
}

/**
 * "Sponsoren & Partner" for the board (Wave 15 M1), read only: the list grouped as "Läuft bald aus" / "Aktiv" / "Geplant" /
 * "Abgelaufen" (status derived by the server), a tap opens the details (term, Gegenleistung, contacts, visibility). Gated by
 * `sponsors:read` / `sponsors:write` (`GET /club-members/me` permissions, deny by default; the server checks again and
 * answers 403 for everybody else). Creating and editing, logo upload and external logins stay on the website. No amounts:
 * billing is not part of MyVerein. Logos only through `OrgLogo` (signed media URL).
 */
export default function SponsorenScreen() {
  const { t, language } = useLanguage();
  const { activeClub, error: clubsError, loading: clubsLoading } = useMyClubs();
  const clubId = activeClub?.clubId ?? null;
  const { can, loading: membershipLoading } = useOwnMembership(clubId);
  const allowed = canSeeSponsors(can);
  const { sponsors, loading, error, reload } = useSponsors(clubId, allowed);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = sponsors?.find((s) => s.id === openId) ?? null;

  let body: React.ReactNode;
  if (clubsLoading || (membershipLoading && !allowed)) body = <Skeleton shape="rows" lines={4} />;
  else if (!activeClub && clubsError) body = <ClubsLoadError />;
  else if (!activeClub) body = <NoClubChoices />;
  else if (!allowed) body = <EmptyState icon={Lock} title={t('sponsors.forbidden')} />;
  else if (error && !sponsors) body = <ErrorState error={error} fallbackKey="sponsors.error" onRetry={() => void reload()} />;
  else if (!sponsors) body = <Skeleton shape="rows" lines={4} />;
  else if (sponsors.length === 0) body = <EmptyState icon={Handshake} title={t('sponsors.empty.title')} hint={t('sponsors.empty.hint')} />;
  else {
    body = (
      <>
        {groupSponsors(sponsors).map(({ group, items }) => (
          <ListSection key={group} title={t(`sponsors.group.${group}`)} inset={68}>
            {items.map((s) => {
              const left = daysLeftLabel(s, t);
              return (
                <ListRow
                  key={s.id}
                  leading={<OrgLogo name={s.name} uri={s.logoUrl} onExpired={() => void reload()} />}
                  title={s.name}
                  hint={periodHint(s, t, language)}
                  trailing={left ? <Badge tone="warning">{left}</Badge> : undefined}
                  onPress={() => setOpenId(s.id)}
                />
              );
            })}
          </ListSection>
        ))}
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] px-1">{t('sponsors.footer')}</Text>
      </>
    );
  }

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
        refreshControl={allowed ? <RefreshControl refreshing={loading && !!sponsors} onRefresh={() => void reload()} /> : undefined}
      >
        {body}
      </ScrollView>

      <FormSheet visible={!!opened} title={opened?.name ?? ''} onClose={() => setOpenId(null)} cancelLabel={t('sponsors.detail.close')}>
        {opened ? (
          <View style={{ gap: 14 }}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <OrgLogo name={opened.name} uri={opened.logoUrl} size={72} onExpired={() => void reload()} />
              <View style={{ gap: 6 }}>
                <Badge tone={STATUS_TONE[opened.status]}>{t(`sponsors.status.${opened.status}`)}</Badge>
                {daysLeftLabel(opened, t) ? <Badge tone="warning">{daysLeftLabel(opened, t)}</Badge> : null}
              </View>
            </View>
            <SponsorFacts sponsor={opened} showVisibility />
            {opened.contacts.length > 0 ? (
              <View>
                <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-1">{t('sponsors.detail.contacts')}</Text>
                <ContactList contacts={opened.contacts} renderBadge={(c) => (c.isPrimary ? <Badge tone="primary">{t('sponsors.detail.contacts.primary')}</Badge> : null)} />
              </View>
            ) : null}
            {opened.linkedAccountName ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px]">{t('sponsors.detail.linked', { name: opened.linkedAccountName })}</Text> : null}
          </View>
        ) : null}
      </FormSheet>
    </SafeAreaView>
  );
}
