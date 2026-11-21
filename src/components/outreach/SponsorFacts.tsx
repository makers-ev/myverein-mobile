import React from 'react';
import { Linking, Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { formatDay, safeWebLink, type Sponsor } from '@/lib/outreach';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-0.5">{label}</Text>
      {children}
    </View>
  );
}

const body = 'text-foreground dark:text-foreground-dark text-[17px] leading-[24px]';

/**
 * Labelled facts of a sponsor: term, what the club offers in return, description, website and (board view only) where it is
 * shown. Plain selectable text (typed in by the board), no HTML or Markdown. The website opens only when it is an http(s)
 * link. Shared by the board's detail sheet and the sponsor's own screen; no amounts (billing is not part of MyVerein).
 */
export function SponsorFacts({ sponsor, showVisibility }: { sponsor: Pick<Sponsor, 'startsOn' | 'endsOn' | 'consideration' | 'description' | 'website' | 'visibility'>; showVisibility?: boolean }) {
  const { t, language } = useLanguage();
  const from = formatDay(sponsor.startsOn, language);
  const to = formatDay(sponsor.endsOn, language);
  const period = from && to ? t('sponsors.period.range', { from, to }) : to ? t('sponsors.period.until', { date: to }) : from ? t('sponsors.period.from', { date: from }) : t('sponsors.period.open');
  const link = safeWebLink(sponsor.website);
  return (
    <View style={{ gap: 14 }}>
      <Fact label={t('sponsors.detail.period')}>
        <Text className={body} style={{ fontVariant: ['tabular-nums'] }}>{period}</Text>
      </Fact>
      {sponsor.consideration ? (
        <Fact label={t('sponsors.detail.consideration')}>
          <Text selectable className={body}>{sponsor.consideration}</Text>
        </Fact>
      ) : null}
      {sponsor.description ? (
        <Fact label={t('sponsors.detail.description')}>
          <Text selectable className={body}>{sponsor.description}</Text>
        </Fact>
      ) : null}
      {link ? (
        <Fact label={t('sponsors.detail.website')}>
          <Text
            accessibilityRole="link"
            accessibilityLabel={t('sponsors.detail.website.open')}
            onPress={() => void Linking.openURL(link).catch(() => undefined)}
            className="text-primary dark:text-primary-dark text-[17px] leading-[24px]"
            style={{ paddingVertical: 10 }}
          >
            {link}
          </Text>
        </Fact>
      ) : null}
      {showVisibility ? (
        <Fact label={t('sponsors.detail.visibility')}>
          <Text className={body}>{t(`sponsors.detail.visibility.${sponsor.visibility}`)}</Text>
        </Fact>
      ) : null}
    </View>
  );
}
