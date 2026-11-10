import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Check, CircleAlert, CircleHelp, Clock, CloudOff, Ellipsis, Lock, X, type LucideIcon } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import UiButton from '@/components/ui/Button';

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] p-4 mb-4">
      {title ? (
        <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px] font-semibold mb-2">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text className={`text-[15px] leading-[22px] mb-2 ${muted ? 'text-muted-foreground dark:text-muted-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}>{children}</Text>;
}

/** Large touch target (48pt), label always spoken; `secondary` for the non-committing choice. Renders the shared `ui/Button`. */
export function Button({ label, onPress, busy, disabled, secondary, accessibilityHint }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; accessibilityHint?: string }) {
  return (
    <View className="mb-2">
      <UiButton block variant={secondary ? 'secondary' : 'primary'} label={label} onPress={onPress} loading={busy} disabled={disabled} accessibilityHint={accessibilityHint} />
    </View>
  );
}

/** Neutral load error with the reason, "Deine Daten sind sicher." and a secondary retry (same look as `ui/ErrorState`). */
export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  const colors = useThemeColors();
  return (
    <View accessibilityRole="alert" className="py-4">
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <View style={{ marginTop: 1 }}>
          <CloudOff size={20} strokeWidth={1.75} color={colors.mutedForeground} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground dark:text-foreground-dark text-[15px] leading-[22px]">{message}</Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-0.5">{t('ui.error.safe')}</Text>
        </View>
      </View>
      <View className="self-start mt-3" style={{ marginLeft: 30 }}>
        <UiButton variant="secondary" size="M" label={t('connection.retry')} onPress={onRetry} />
      </View>
    </View>
  );
}

export function Loading() {
  const colors = useThemeColors();
  return (
    <View className="py-10 items-center">
      <ActivityIndicator size="large" color={colors.primaryText} />
    </View>
  );
}

/** Status symbols the assembly screens pass in, drawn as line icons (never emoji). Unknown symbols show the label alone. */
const SYMBOL_ICON: Record<string, LucideIcon> = { '✓': Check, '✕': X, '!': CircleAlert, '?': CircleHelp, '⏳': Clock, '…': Ellipsis, lock: Lock };

/** Status label with a leading line icon, so state is never conveyed by colour alone. */
export function Badge({ label, symbol }: { label: string; symbol: string }) {
  const colors = useThemeColors();
  const Icon = SYMBOL_ICON[symbol];
  return (
    <View className="self-start flex-row items-center rounded-md px-2 py-1 bg-muted dark:bg-muted-dark mb-2" style={{ gap: 6 }}>
      {Icon ? <Icon size={14} strokeWidth={1.75} color={colors.mutedForeground} /> : symbol === '●' ? <View className="rounded-full bg-primary dark:bg-primary-dark" style={{ width: 8, height: 8 }} /> : null}
      <Text className="text-[13px] leading-[18px] font-medium text-foreground dark:text-foreground-dark">{label}</Text>
    </View>
  );
}

/** Text for a backend value the app has no key for yet (new role / outcome / phase): the fallback instead of the raw key. */
export function labelOr(t: (key: string, params?: Record<string, string | number>) => string, key: string, fallbackKey: string, params?: Record<string, string | number>): string {
  const text = t(key, params);
  return text === key ? t(fallbackKey, params) : text;
}
