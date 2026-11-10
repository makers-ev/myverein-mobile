import React, { createContext, useContext, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';
import Count from './Count';
import PressScale from './PressScale';

/** Set by `ListSection` (the divider inset): rows inside a section share its surface and draw an inset hairline above themselves instead of their own card. `null` = standalone. */
export const InListSection = createContext<number | null>(null);

interface Props {
  title: string;
  /** Secondary line (Body/M muted). Wraps, never truncated. */
  hint?: string;
  /** Omit for a read-only row: no chevron, not announced as a button. */
  onPress?: () => void;
  /** Leading line icon in a quiet 32pt tile. */
  icon?: LucideIcon;
  /** Custom leading element instead of `icon` (avatar, colour dot). */
  leading?: ReactNode;
  /** Trailing number. `attention` (red) only when the viewer has to act on it. */
  count?: number;
  countTone?: 'attention' | 'quiet' | 'primary';
  /** Trailing value text (e.g. "39", "12,5 h"), tabular figures. */
  value?: string;
  /** Custom trailing element (a switch, a badge). */
  trailing?: ReactNode;
  /** Danger-coloured title, no chevron (e.g. "Abmelden"). */
  destructive?: boolean;
  /** Hide the chevron even though the row is pressable (it opens a sheet or an external page with its own icon). */
  noChevron?: boolean;
  accessibilityHint?: string;
  /** @deprecated use `count` (+ `countTone`). Kept so older call sites keep compiling: rendered as a quiet count. */
  badge?: number;
}

/**
 * List row (Figma `ListRow`): Body/L title, optional muted hint, trailing chevron / count / value / custom. At least
 * 52pt high and grows with the text. The chevron appears ONLY when the row navigates (rule k). Inside a `ListSection`
 * it shares the section surface; on its own it draws its own card.
 */
export default function ListRow({ title, hint, onPress, icon: Icon, leading, count, countTone = 'quiet', value, trailing, destructive, noChevron, accessibilityHint, badge }: Props) {
  const colors = useThemeColors();
  const sectionInset = useContext(InListSection);
  const inSection = sectionInset !== null;
  const n = count ?? badge ?? 0;
  const label = [title, hint, value, n > 0 ? String(n) : null].filter(Boolean).join('. ');
  const surface = inSection ? '' : 'bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] mb-2';
  const body = (
    <>
      {leading ? <View className="mr-3">{leading}</View> : null}
      {Icon && !leading ? (
        <View className="bg-muted dark:bg-muted-dark rounded-md items-center justify-center mr-3" style={{ width: 32, height: 32 }}>
          <Icon size={18} strokeWidth={1.75} color={destructive ? colors.destructive : colors.foreground} />
        </View>
      ) : null}
      <View className="flex-1 pr-3 py-3">
        <Text className={`text-[17px] leading-[22px] ${destructive ? 'text-destructive dark:text-destructive-dark font-medium' : 'text-foreground dark:text-foreground-dark'}`}>{title}</Text>
        {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-5 mt-0.5">{hint}</Text> : null}
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {value ? (
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[17px]" style={{ fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
        ) : null}
        <Count value={n} tone={count !== undefined ? countTone : 'quiet'} />
        {trailing}
        {onPress && !destructive && !noChevron ? <ChevronRight size={20} strokeWidth={1.75} color={colors.mutedForeground} /> : null}
      </View>
    </>
  );
  const divider = inSection ? <View className="bg-border dark:bg-border-dark" style={{ height: 1, marginLeft: sectionInset }} /> : null;
  if (!onPress) {
    return (
      <View>
        {divider}
        <View accessible accessibilityLabel={label} className={`flex-row items-center px-4 ${surface}`} style={{ minHeight: 52 }}>
          {body}
        </View>
      </View>
    );
  }
  return (
    <View>
      {divider}
      <PressScale
        className={`flex-row items-center px-4 ${surface}`}
        style={{ minHeight: 52 }}
        scale={0.99}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
      >
        {body}
      </PressScale>
    </View>
  );
}
