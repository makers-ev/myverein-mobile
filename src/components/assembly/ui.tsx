import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      {title ? (
        <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-bold text-base mb-2">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text className={`text-sm mb-2 ${muted ? 'text-muted-foreground dark:text-muted-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}>{children}</Text>;
}

/** Large touch target (48pt), label always spoken; `secondary` for the non-committing choice. */
export function Button({ label, onPress, busy, disabled, secondary, accessibilityHint }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; accessibilityHint?: string }) {
  const colors = useThemeColors();
  const off = busy || disabled;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      className={`min-h-[48px] rounded-xl px-5 items-center justify-center mb-2 ${secondary ? 'bg-muted dark:bg-muted-dark border border-border dark:border-border-dark' : 'bg-primary dark:bg-primary-dark'} ${off ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.primary : colors.primaryForeground} />
      ) : (
        <Text className={`font-bold text-sm ${secondary ? 'text-foreground dark:text-foreground-dark' : 'text-primary-foreground dark:text-primary-foreground-dark'}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <View className="py-4">
      <Text accessibilityRole="alert" className="text-destructive text-sm mb-2">
        {message}
      </Text>
      <TouchableOpacity accessibilityRole="button" onPress={onRetry} className="min-h-[44px] justify-center self-start">
        <Text className="text-primary dark:text-primary-dark font-semibold">{t('connection.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function Loading() {
  const colors = useThemeColors();
  return (
    <View className="py-10 items-center">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

/** Status text with a leading symbol, so state is never conveyed by colour alone. */
export function Badge({ label, symbol }: { label: string; symbol: string }) {
  return (
    <View className="self-start rounded-full px-3 py-1 bg-muted dark:bg-muted-dark border border-border dark:border-border-dark mb-2">
      <Text className="text-xs font-semibold text-foreground dark:text-foreground-dark">{`${symbol} ${label}`}</Text>
    </View>
  );
}

/** Text for a backend value the app has no key for yet (new role / outcome / phase): the fallback instead of the raw key. */
export function labelOr(t: (key: string, params?: Record<string, string | number>) => string, key: string, fallbackKey: string, params?: Record<string, string | number>): string {
  const text = t(key, params);
  return text === key ? t(fallbackKey, params) : text;
}
