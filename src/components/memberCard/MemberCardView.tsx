import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import SignedImage from '@/components/ui/SignedImage';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { formatDocumentDate } from '@/lib/documents';
import { type CardState, canShowQr, effectiveCardState, formatCardStand, localDay } from '@/lib/memberCard';
import { blend } from '@/theme/contrast';
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
const QR_SIZE = 200;

const PHOTO_W = 76;
const PHOTO_H = 96;

/** Up to two capital letters of the club name, for the monogram next to it. */
function monogram(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2);
  return letters.toUpperCase();
}

interface Props {
  view: View_;
  /** A saved copy is waiting for the server's answer: the QR stays hidden until then. */
  confirming?: boolean;
  /** Reload when the signed photo URL expired. */
  onPhotoExpired: () => void;
}

/**
 * The card itself, the one bright element of the app: a club-coloured ID card (monogram, club name, photo or initials
 * without consent, name, number, category, validity) with fine concentric rings as its only ornament, a perforation, and
 * below it the ticket stub with the status as icon + word (never colour alone) and the QR on white. Without a network the
 * cached copy is shown with "Stand von ..." and the QR disappears as soon as the card ended or the token expired (device date).
 */
export default function MemberCardView({ view, confirming = false, onPhotoExpired }: Props) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const { card } = view;
  const now = new Date();
  const state = effectiveCardState(card, localDay(now));
  const showQr = !confirming && canShowQr(card, localDay(now), now.getTime());
  // The backend keeps the club colour at >= 4.5:1 against white; without one the theme pair is used (readable in both modes).
  const customBand = !!card.club.primaryColor && HEX.test(card.club.primaryColor);
  const band = customBand ? (card.club.primaryColor as string) : colors.primary;
  const bandText = customBand ? '#FFFFFF' : colors.primaryForeground;
  // A small tone shift inside the same hue (towards the text colour, so contrast only grows) and a tint for ornaments.
  const bandEnd = blend(bandText, band, 0.16);
  const tint = blend(bandText, band, 0.2);
  const stateColor = state === 'gueltig' ? colors.success : state === 'abgelaufen' ? colors.warning : colors.destructive;
  const StateIcon = state === 'gueltig' ? CheckCircle2 : state === 'abgelaufen' ? AlertTriangle : XCircle;
  const stand = formatCardStand(view.checkedAt);
  const tokenExpired = state === 'gueltig' && !showQr && !confirming;
  const isDark = colorScheme === 'dark';

  return (
    <View
      className="mb-6"
      style={{ borderRadius: 20, shadowColor: '#000', shadowOpacity: isDark ? 0 : 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: isDark ? 0 : 4 }}
    >
      <View className="overflow-hidden border border-border dark:border-border-dark bg-card dark:bg-card-dark" style={{ borderRadius: 20 }}>
        <View style={{ backgroundColor: band, minHeight: 208 }} className="p-5 justify-between">
          <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Defs>
              <LinearGradient id="face" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={band} />
                <Stop offset="1" stopColor={bandEnd} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#face)" />
            {[56, 80, 104, 128, 152, 176, 200, 224, 248, 272, 296].map((r) => (
              <Circle key={r} cx="100%" cy="0" r={r} fill="none" stroke={tint} strokeWidth={1} opacity={0.55} />
            ))}
          </Svg>

          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tint }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text maxFontSizeMultiplier={1.2} className="text-sm font-semibold" style={{ color: bandText }}>
                {monogram(card.club.name)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: bandText }} numberOfLines={2}>
                {card.club.name}
              </Text>
              <Text className="text-xs" style={{ color: bandText, opacity: 0.9 }}>
                {t('card.title')}
              </Text>
            </View>
          </View>

          <View className="flex-row items-end mt-6" style={{ gap: 16 }}>
            {view.photoUri ? (
              view.photoUri.startsWith('file:') ? (
                <LocalPhoto uri={view.photoUri} initials={card.member.initials} tint={tint} color={bandText} />
              ) : (
                <SignedImage uri={view.photoUri} style={{ width: PHOTO_W, height: PHOTO_H, borderRadius: 10 }} onExpired={onPhotoExpired} fallback={<Initials text={card.member.initials} tint={tint} color={bandText} />} />
              )
            ) : (
              <Initials text={card.member.initials} tint={tint} color={bandText} />
            )}
            <View className="flex-1">
              <Text className="text-[22px] leading-7 font-medium" style={{ color: bandText }} accessibilityRole="header">
                {card.member.displayName}
              </Text>
              {card.member.memberNumber ? (
                <Text className="text-sm mt-1" style={{ color: bandText, fontVariant: ['tabular-nums'] }}>
                  {t('card.number', { number: card.member.memberNumber })}
                </Text>
              ) : null}
              {card.member.category ? (
                <Text className="text-sm" style={{ color: bandText }}>
                  {card.member.category}
                </Text>
              ) : null}
              {card.validUntil ? (
                <Text className="text-sm" style={{ color: bandText, fontVariant: ['tabular-nums'] }}>
                  {t('card.valid-until', { date: formatDocumentDate(card.validUntil) })}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Perforation between the card and its stub: two notches in the page colour and a dashed line. */}
        <View style={{ height: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ position: 'absolute', left: -10, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.background }} />
          <View style={{ position: 'absolute', right: -10, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.background }} />
        </View>

        <View className="px-5 pt-5 pb-4" style={{ gap: 16 }}>
          <View className="flex-row items-center" style={{ gap: 8 }} accessible accessibilityRole="text" accessibilityLabel={t(STATE_KEY[state])}>
            <StateIcon size={20} strokeWidth={1.75} color={stateColor} />
            <Text className="text-base font-medium" style={{ color: stateColor }}>
              {t(STATE_KEY[state])}
            </Text>
          </View>

          {showQr && card.token ? (
            <View className="items-center">
              <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} accessible accessibilityLabel={t('card.qr-label')}>
                <QRCode value={card.token} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" ecl="M" quietZone={4} />
              </View>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-3 text-center">{t('card.qr-hint')}</Text>
            </View>
          ) : null}

          {confirming && state === 'gueltig' ? <Notice text={t('card.confirming')} live /> : null}
          {tokenExpired ? <Notice text={t('card.token-expired')} /> : null}
          {card.hint && state !== 'gueltig' ? <Notice text={t(`card.hint.${card.hint}`)} /> : null}
          {view.fromCache && stand ? <Notice text={t('card.stand-offline', { stand })} live /> : stand ? <Notice text={t('card.stand', { stand })} /> : null}
        </View>
      </View>
    </View>
  );
}

function Initials({ text, tint, color }: { text: string; tint: string; color: string }) {
  return (
    <View className="items-center justify-center" style={{ width: PHOTO_W, height: PHOTO_H, borderRadius: 10, backgroundColor: tint }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text className="text-3xl font-medium" style={{ color }}>
        {text}
      </Text>
    </View>
  );
}

function Notice({ text, live }: { text: string; live?: boolean }) {
  return (
    <Text accessibilityLiveRegion={live ? 'polite' : undefined} className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
      {text}
    </Text>
  );
}

/** The offline photo file; a missing or unreadable file falls back to the initials. */
function LocalPhoto({ uri, initials, tint, color }: { uri: string; initials: string; tint: string; color: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === uri) return <Initials text={initials} tint={tint} color={color} />;
  return <Image source={{ uri }} style={{ width: PHOTO_W, height: PHOTO_H, borderRadius: 10 }} resizeMode="cover" accessibilityIgnoresInvertColors onError={() => setFailed(uri)} />;
}
