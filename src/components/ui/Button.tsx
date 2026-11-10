import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/theme/colors';
import PressScale from './PressScale';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'inverse' | 'inverseOutline';

interface Props {
  /** Name the outcome ("Zum 31.03.2027 genehmigen", "Zusagen"), not the mechanism ("OK", "Senden"). */
  label: string;
  onPress: () => void;
  /**
   * `primary` solid fill, at most one per screen region; `secondary` neutral with a visible boundary; `tertiary` text
   * only (links like "Kalender öffnen"); `destructive` solid red, only for irreversible actions behind a confirmation.
   * `inverse` / `inverseOutline` sit ON a primary fill (hero card): white fill with primary text / white outline.
   * `danger` is the former name of `destructive`.
   */
  variant?: ButtonVariant | 'danger';
  /** `L` 48pt (default), `M` 40pt visual with a 44pt hit area. */
  size?: 'L' | 'M';
  icon?: LucideIcon;
  /** Stretch to the available width. */
  block?: boolean;
  disabled?: boolean;
  /** Shows a spinner next to the label and blocks taps while saving. */
  loading?: boolean;
  accessibilityHint?: string;
}

const BOX = {
  primary: 'bg-primary dark:bg-primary-dark',
  secondary: 'bg-card dark:bg-card-dark border border-border-control dark:border-border-control-dark',
  tertiary: '',
  destructive: 'bg-destructive-fill dark:bg-destructive-fill-dark',
  inverse: 'bg-white',
  inverseOutline: 'border border-white',
} as const;

const TEXT = {
  primary: 'text-primary-foreground dark:text-primary-foreground-dark',
  secondary: 'text-foreground dark:text-foreground-dark',
  tertiary: 'text-primary dark:text-primary-dark',
  destructive: 'text-white',
  inverse: '',
  inverseOutline: 'text-white',
} as const;

/**
 * The standard button (Figma `Button`): 48pt (L) or 40pt (M, 44pt hit area), radius 10, Label/M text. Disabled keeps an
 * AA-readable label on the sunken surface instead of fading to 50 % -- people must still be able to read what they
 * cannot do yet (and the screen should say why). Busy and disabled states are announced; a press scales it by 2 %.
 */
export default function Button({ label, onPress, variant = 'primary', size = 'L', icon: Icon, block, disabled, loading, accessibilityHint }: Props) {
  const colors = useThemeColors();
  const v: ButtonVariant = variant === 'danger' ? 'destructive' : variant;
  const blocked = !!disabled || !!loading;
  const height = size === 'L' ? 48 : 40;
  const box = disabled ? (v === 'tertiary' ? '' : 'bg-muted dark:bg-muted-dark') : BOX[v];
  const text = disabled ? 'text-muted-foreground dark:text-muted-foreground-dark' : TEXT[v];
  // The fill colour as text on white (inverse): `text-primary` maps to primaryText, so use the fill value directly.
  const textStyle = !disabled && v === 'inverse' ? { color: colors.primary } : undefined;
  const iconColor = disabled
    ? colors.mutedForeground
    : v === 'primary'
      ? colors.primaryForeground
      : v === 'destructive'
        ? colors.destructiveForeground
        : v === 'tertiary'
          ? colors.primaryText
          : v === 'inverse'
            ? colors.primary
            : v === 'inverseOutline'
              ? '#ffffff'
              : colors.foreground;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: !!loading }}
      disabled={blocked}
      onPress={onPress}
      hitSlop={size === 'M' ? { top: 2, bottom: 2 } : undefined}
      style={{ minHeight: height }}
      className={`rounded-[10px] ${v === 'tertiary' ? 'px-3' : size === 'L' ? 'px-5' : 'px-4'} justify-center items-center flex-row ${block ? 'self-stretch' : ''} ${box}`}
    >
      <View className="flex-row items-center justify-center py-2.5" style={{ gap: 8 }}>
        {loading ? <ActivityIndicator size="small" color={iconColor} /> : Icon ? <Icon size={20} strokeWidth={1.75} color={iconColor} /> : null}
        <Text className={`text-[15px] leading-5 font-semibold text-center ${text}`} style={textStyle}>
          {label}
        </Text>
      </View>
    </PressScale>
  );
}
