import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Pencil, Plus } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { ApiError } from '@/lib/api';

export function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export type Tone = 'success' | 'warning' | 'destructive' | 'primary' | 'muted';

// Full literal class names so NativeWind's content scan picks them up.
const TONE_CLASSES: Record<Tone, { bg: string; text: string }> = {
  success: { bg: 'bg-success/15 dark:bg-success-dark/15', text: 'text-success dark:text-success-dark' },
  warning: { bg: 'bg-warning/15 dark:bg-warning-dark/15', text: 'text-warning dark:text-warning-dark' },
  destructive: { bg: 'bg-destructive/15 dark:bg-destructive-dark/15', text: 'text-destructive dark:text-destructive-dark' },
  primary: { bg: 'bg-primary/10 dark:bg-primary-dark/10', text: 'text-primary dark:text-primary-dark' },
  muted: { bg: 'bg-muted dark:bg-muted-dark', text: 'text-muted-foreground dark:text-muted-foreground-dark' },
};

export function StatusChip({ label, tone, icon }: { label: string; tone: Tone; icon?: React.ReactNode }) {
  const c = TONE_CLASSES[tone];
  return (
    <View className={`flex-row items-center px-2.5 py-1 rounded-full self-start ${c.bg}`} style={{ gap: 4 }}>
      {icon}
      <Text className={`text-xs font-semibold ${c.text}`}>{label}</Text>
    </View>
  );
}

/** Returns the theme color for a tone, for icon `color` props. */
export function useToneColor(tone: Tone): string {
  const colors = useThemeColors();
  return tone === 'muted' ? colors.mutedForeground : colors[tone];
}

/** Single-select chip row; horizontal-scrolling when `scroll` is set. */
export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const chips = options.map((o) => {
    const active = o.value === value;
    return (
      <TouchableOpacity
        key={o.value}
        onPress={() => onChange(o.value)}
        className={`px-3 py-1.5 rounded-full border ${
          active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
        }`}
      >
        <Text
          className={`text-sm ${active ? 'text-primary-foreground dark:text-primary-foreground-dark font-bold' : 'text-foreground dark:text-foreground-dark'}`}
        >
          {o.label}
        </Text>
      </TouchableOpacity>
    );
  });
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {chips}
    </ScrollView>
  ) : (
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      {chips}
    </View>
  );
}

export function IconButton({ kind, onPress, label }: { kind: 'add' | 'edit'; onPress: () => void; label: string }) {
  const themeColors = useThemeColors();
  return kind === 'add' ? (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      className="w-9 h-9 rounded-full bg-primary dark:bg-primary-dark items-center justify-center"
    >
      <Plus size={18} color={themeColors.primaryForeground} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      className="w-8 h-8 rounded-full bg-muted dark:bg-muted-dark items-center justify-center"
    >
      <Pencil size={14} color={themeColors.foreground} />
    </TouchableOpacity>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View className="items-center py-10 px-6 border border-dashed border-border dark:border-border-dark rounded-2xl">
      <View className="w-14 h-14 rounded-full items-center justify-center bg-primary/10 dark:bg-primary-dark/10 mb-3">{icon}</View>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm text-center">{text}</Text>
    </View>
  );
}

export function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const themeColors = useThemeColors();
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="flex-1 text-foreground dark:text-foreground-dark text-sm">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: themeColors.primary, false: themeColors.border }} />
    </View>
  );
}

/** Native destructive confirm dialog. */
export function confirmDelete(title: string, message: string, labels: { cancel: string; confirm: string }, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: labels.cancel, style: 'cancel' },
    { text: labels.confirm, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Saving/error state for a FormSheet submit; `run` maps thrown errors to a display message. */
export function useSubmit() {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setSaving(true);
      setError(null);
      try {
        await action();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
      } finally {
        setSaving(false);
      }
    },
    [t],
  );

  return { saving, error, setError, run };
}

/** Empty string -> `blank` (undefined on create, null on PATCH to clear). */
export function orBlank<B extends null | undefined>(value: string, blank: B): string | B {
  const trimmed = value.trim();
  return trimmed ? trimmed : blank;
}

// `condition` is free text on the backend; these are the known values with translations.
export const KNOWN_CONDITIONS = ['gut', 'beschaedigt', 'defekt'];
const CONDITION_TONES: Record<string, Tone> = { gut: 'success', beschaedigt: 'warning', defekt: 'destructive' };

export function conditionLabel(t: (key: string) => string, condition: string): string {
  return KNOWN_CONDITIONS.includes(condition) ? t(`material.condition.${condition}`) : condition;
}

export function conditionTone(condition: string): Tone {
  return CONDITION_TONES[condition] ?? 'muted';
}
