import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import SignedImage from '@/components/ui/SignedImage';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { formatDocumentDate } from '@/lib/documents';
import { type CardState, canShowQr, effectiveCardState, formatCardStand, localDay } from '@/lib/memberCard';
import { useThemeColors } from '@/theme/colors';
import type { MemberCardView as View_ } from '@/hooks/useMemberCard';

const STATE_KEY: Record<CardState, string> = {
  gueltig: 'card.state.gueltig',
  abgelaufen: 'card.state.abgelaufen',
  ausgetreten: 'card.state.ausgetreten',
  ungueltig: 'card.state.ungueltig',
  nicht_ausgestellt: 'card.state.nicht_ausgestellt',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The QR always sits on white with black modules and a quiet zone, also in dark mode, so any scanner reads it. */
const QR_SIZE = 220;

interface Props {
  view: View_;
  /** Reload when the signed photo URL expired. */
  onPhotoExpired: () => void;
}

/**
 * The card itself: club colour band, photo (or initials without consent), name, number, category, validity, status as
 * icon + word (never colour alone) and the QR. Without a network the cached copy is shown with "Stand von ..." and the
 * QR disappears as soon as the card ended or the token expired (device date).
 */
export default function MemberCardView({ view, onPhotoExpired }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const { card } = view;
  const now = new Date();
  const state = effectiveCardState(card, localDay(now));
  const showQr = canShowQr(card, localDay(now), now.getTime());
  // The backend keeps the club colour at >= 4.5:1 against white; without one the theme pair is used (readable in both modes).
  const customBand = !!card.club.primaryColor && HEX.test(card.club.primaryColor);
  const band = customBand ? (card.club.primaryColor as string) : colors.primary;
  const bandText = customBand ? '#FFFFFF' : colors.primaryForeground;
  const stateColor = state === 'gueltig' ? colors.success : state === 'abgelaufen' ? colors.warning : colors.destructive;
  const StateIcon = state === 'gueltig' ? CheckCircle2 : state === 'abgelaufen' ? AlertTriangle : XCircle;
  const stand = formatCardStand(view.checkedAt);
  const tokenExpired = state === 'gueltig' && !showQr;

  return (
    <View className="rounded-2xl overflow-hidden border border-border dark:border-border-dark bg-card dark:bg-card-dark mb-4">
      <View style={{ backgroundColor: band }} className="px-4 py-3">
        <Text className="font-black text-base" style={{ color: bandText }} numberOfLines={2}>
          {card.club.name}
        </Text>
        <Text className="text-xs" style={{ color: bandText }}>
          {t('card.title')}
        </Text>
      </View>

      <View className="p-4 flex-row items-center" style={{ gap: 16 }}>
        {view.photoUri ? (
          view.photoUri.startsWith('file:') ? (
            <LocalPhoto uri={view.photoUri} initials={card.member.initials} />
          ) : (
            <SignedImage uri={view.photoUri} style={{ width: 88, height: 110, borderRadius: 8 }} onExpired={onPhotoExpired} fallback={<Initials text={card.member.initials} />} />
          )
        ) : (
          <Initials text={card.member.initials} />
        )}
        <View className="flex-1">
          <Text className="text-foreground dark:text-foreground-dark text-xl font-black" accessibilityRole="header">
            {card.member.displayName}
          </Text>
          {card.member.memberNumber ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mt-1">{t('card.number', { number: card.member.memberNumber })}</Text> : null}
          {card.member.category ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{card.member.category}</Text> : null}
          {card.validUntil ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('card.valid-until', { date: formatDocumentDate(card.validUntil) })}</Text> : null}
        </View>
      </View>

      <View className="px-4 pb-3 flex-row items-center" style={{ gap: 8 }} accessible accessibilityRole="text" accessibilityLabel={t(STATE_KEY[state])}>
        <StateIcon size={22} color={stateColor} />
        <Text className="text-base font-bold" style={{ color: stateColor }}>
          {t(STATE_KEY[state])}
        </Text>
      </View>

      {showQr && card.token ? (
        <View className="items-center pb-4">
          <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12 }} accessible accessibilityLabel={t('card.qr-label')}>
            <QRCode value={card.token} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" ecl="M" quietZone={4} />
          </View>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2 px-4 text-center">{t('card.qr-hint')}</Text>
        </View>
      ) : null}

      {tokenExpired ? <Notice text={t('card.token-expired')} /> : null}
      {card.hint && state !== 'gueltig' ? <Notice text={t(`card.hint.${card.hint}`)} /> : null}
      {view.fromCache && stand ? <Notice text={t('card.stand-offline', { stand })} live /> : stand ? <Notice text={t('card.stand', { stand })} /> : null}
    </View>
  );
}

function Initials({ text }: { text: string }) {
  return (
    <View className="bg-muted dark:bg-muted-dark items-center justify-center" style={{ width: 88, height: 110, borderRadius: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text className="text-foreground dark:text-foreground-dark text-3xl font-black">{text}</Text>
    </View>
  );
}

function Notice({ text, live }: { text: string; live?: boolean }) {
  return (
    <Text accessibilityLiveRegion={live ? 'polite' : undefined} className="text-muted-foreground dark:text-muted-foreground-dark text-xs px-4 pb-3">
      {text}
    </Text>
  );
}

/** The offline photo file; a missing or unreadable file falls back to the initials. */
function LocalPhoto({ uri, initials }: { uri: string; initials: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === uri) return <Initials text={initials} />;
  return <Image source={{ uri }} style={{ width: 88, height: 110, borderRadius: 8 }} resizeMode="cover" accessibilityIgnoresInvertColors onError={() => setFailed(uri)} />;
}
