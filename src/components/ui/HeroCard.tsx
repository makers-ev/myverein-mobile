import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import PressScale from './PressScale';
import Title from './Title';

interface Props {
  /** Small line above the title, e.g. "Heute · 18:30 – 20:00" (tabular figures). */
  eyebrow?: string;
  title: string;
  /** One or two meta lines under the title (place, answers). */
  meta?: string;
  /** Actions (use `Button` variants `inverse` / `inverseOutline` on the primary fill). */
  children?: ReactNode;
  /** Whole card opens the detail (actions inside still work). */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** `primary` = the one hero of the screen (primary fill). `quiet` = calm surface for an empty/next-step hero. */
  tone?: 'primary' | 'quiet';
}

/**
 * Hero card (Figma `Card / Hero`): the one thing that matters next, at most once per screen. Primary fill, 20 radius,
 * 20 padding, serif title. Every other block on the screen is a list section or a quiet card.
 */
export default function HeroCard({ eyebrow, title, meta, children, onPress, accessibilityLabel, tone = 'primary' }: Props) {
  const filled = tone === 'primary';
  const strong = filled ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark';
  const soft = filled ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark';
  const cls = `rounded-[20px] p-5 ${filled ? 'bg-primary dark:bg-primary-dark' : 'bg-card dark:bg-card-dark border border-border dark:border-border-dark'}`;
  const content = (
    <>
      {eyebrow ? (
        <Text className={`text-[13px] leading-[18px] font-medium mb-1 ${soft}`} style={{ fontVariant: ['tabular-nums'], opacity: filled ? 0.92 : 1 }}>
          {eyebrow}
        </Text>
      ) : null}
      <Title header={false} size="L" className={strong}>
        {title}
      </Title>
      {meta ? (
        <Text className={`text-[15px] leading-[22px] mt-1 ${soft}`} style={{ fontVariant: ['tabular-nums'] }}>
          {meta}
        </Text>
      ) : null}
      {children ? (
        <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
          {children}
        </View>
      ) : null}
    </>
  );
  if (!onPress) return <View className={cls}>{content}</View>;
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [eyebrow, title, meta].filter(Boolean).join('. ')} onPress={onPress} scale={0.99} className={cls}>
      {content}
    </PressScale>
  );
}
