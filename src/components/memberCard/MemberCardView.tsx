import React, { useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import SignedImage from '@/components/ui/SignedImage';
import Title from '@/components/ui/Title';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { formatDocumentDate } from '@/lib/documents';
import { type CardState, canShowQr, effectiveCardState, formatCardStand, localDay } from '@/lib/memberCard';
import { blend, luminance } from '@/theme/contrast';
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
 * The card itself, the one hero moment of the app: a flat club-coloured ID card (monogram, club name in the display
 * serif, photo or initials without consent, name, number, category, validity), a 3pt Pokal-Gold stripe, a perforation, and
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
  // The monogram/initials tile shifts inside the same hue, always AWAY from the text colour so the text contrast never
  // drops below the band's own: darker for light text, lighter for dark text.
  const away = luminance(bandText) > luminance(band) ? '#000000' : '#FFFFFF';
  const tint = blend(away, band, 0.14);
  const stateColor = state === 'gueltig' ? colors.success : state === 'abgelaufen' ? colors.warning : colors.destructive;
  const StateIcon = state === 'gueltig' ? CheckCircle2 : state === 'abgelaufen' ? AlertTriangle : XCircle;
  const stand = formatCardStand(view.checkedAt);
  const tokenExpired = state === 'gueltig' && !showQr && !confirming;
  const isDark = colorScheme === 'dark';

  return (
    <View
      className="mb-6"
      style={{ borderRadius: 20, shadowColor: '#000', shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: isDark ? 0 : 2 }}
    >
      <View className="overflow-hidden border border-border dark:border-border-dark bg-card dark:bg-card-dark" style={{ borderRadius: 20 }}>
        <View style={{ backgroundColor: band, minHeight: 208 }} className="p-5 justify-between">

          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tint }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text maxFontSizeMultiplier={1.2} className="text-sm font-semibold" style={{ color: bandText }}>
                {monogram(card.club.name)}
              </Text>
            </View>
            <View className="flex-1">
              <Title size="M" header={false} numberOfLines={2} className="" style={{ color: bandText, fontSize: 24, lineHeight: 28 }}>
                {card.club.name}
              </Title>
              <Text className="text-[13px] leading-[18px] font-medium mt-0.5" style={{ color: bandText }}>
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
              <Text className="text-[20px] leading-[26px] font-semibold" style={{ color: bandText }} accessibilityRole="header">
                {card.member.displayName}
              </Text>
              {card.member.memberNumber ? (
                <Text className="text-[15px] leading-5 mt-1" style={{ color: bandText, fontVariant: ['tabular-nums'], fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>
                  {t('card.number', { number: card.member.memberNumber })}
                </Text>
              ) : null}
              {card.member.category ? (
                <Text className="text-[15px] leading-5" style={{ color: bandText }}>
                  {card.member.category}
                </Text>
              ) : null}
              {card.validUntil ? (
                <Text className="text-[15px] leading-5" style={{ color: bandText, fontVariant: ['tabular-nums'] }}>
                  {t('card.valid-until', { date: formatDocumentDate(card.validUntil) })}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Pokal-Gold stripe along the bottom edge of the card face (the club's own accent). */}
        <View style={{ height: 3, backgroundColor: colors.accent }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />

        {/* Perforation between the card and its stub: two notches in the page colour and a dashed line. */}
        <View style={{ height: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ position: 'absolute', left: -10, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.muted }} />
          <View style={{ position: 'absolute', right: -10, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.muted }} />
        </View>

        <View className="px-5 pt-5 pb-4" style={{ gap: 16 }}>
          <View className="flex-row items-center" style={{ gap: 8 }} accessible accessibilityRole="text" accessibilityLabel={t(STATE_KEY[state])}>
            <StateIcon size={22} strokeWidth={1.75} color={stateColor} />
            <Text className="text-[17px] leading-[22px] font-semibold" style={{ color: stateColor }}>
              {t(STATE_KEY[state])}
            </Text>
          </View>

          {showQr && card.token ? (
            <View className="items-center">
              <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} accessible accessibilityLabel={t('card.qr-label')}>
                <QRCode value={card.token} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" ecl="M" quietZone={4} />
              </View>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-3 text-center">{t('card.qr-hint')}</Text>
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
    <Text accessibilityLiveRegion={live ? 'polite' : undefined} className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px]">
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
