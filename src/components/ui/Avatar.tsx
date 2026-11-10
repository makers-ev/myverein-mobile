import React from 'react';
import { Image, Text, View } from 'react-native';

const SIZES = { S: { box: 32, text: 'text-[13px]' }, M: { box: 40, text: 'text-[15px]' }, L: { box: 72, text: 'text-[24px]' } } as const;

/** Initials of a display name ("Heike Brandt" -> "HB"). */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

/**
 * Avatar (Figma `Avatar`): S 32 / M 40 / L 72, round, initials on the sunken surface (or `accent` soft for the club
 * crest). A photo URI must already be a signed, short-lived URL from the media layer (see `SignedImage`). Decorative:
 * the name is always written next to it.
 */
export default function Avatar({ name, uri, size = 'M', tone = 'neutral' }: { name: string | null | undefined; uri?: string | null; size?: 'S' | 'M' | 'L'; tone?: 'neutral' | 'accent' }) {
  const s = SIZES[size];
  const box = tone === 'accent' ? 'bg-accent-soft dark:bg-accent-soft-dark' : 'bg-muted dark:bg-muted-dark';
  const text = tone === 'accent' ? 'text-accent-soft-foreground dark:text-accent-soft-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`rounded-full items-center justify-center overflow-hidden ${box}`}
      style={{ width: s.box, height: s.box }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: s.box, height: s.box }} />
      ) : (
        <Text maxFontSizeMultiplier={1.2} className={`${s.text} font-semibold ${text}`}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
