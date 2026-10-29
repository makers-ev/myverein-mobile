import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  /** `primary` filled (one per screen), `secondary` bordered, `danger` destructive text. */
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  /** Shows a spinner and blocks taps while saving. */
  loading?: boolean;
  accessibilityHint?: string;
}

const STYLES = {
  primary: { box: 'bg-primary dark:bg-primary-dark', text: 'text-primary-foreground dark:text-primary-foreground-dark' },
  secondary: { box: 'bg-card dark:bg-card-dark border border-border dark:border-border-dark', text: 'text-primary dark:text-primary-dark' },
  danger: { box: 'bg-card dark:bg-card-dark border border-destructive', text: 'text-destructive dark:text-destructive-dark' },
} as const;

/** The standard button: at least 44pt high, label as accessibility name, busy and disabled states announced. */
export default function Button({ label, onPress, variant = 'primary', disabled, loading, accessibilityHint }: Props) {
  const s = STYLES[variant];
  const blocked = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      disabled={blocked}
      activeOpacity={0.7}
      onPress={onPress}
      style={{ minHeight: 44, opacity: blocked ? 0.6 : 1 }}
      className={`rounded-xl px-5 justify-center items-center flex-row ${s.box}`}
    >
      {loading ? <ActivityIndicator size="small" className="mr-2" /> : null}
      <Text className={`font-bold text-sm ${s.text}`}>{label}</Text>
    </TouchableOpacity>
  );
}
