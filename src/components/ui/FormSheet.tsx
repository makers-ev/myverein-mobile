import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  /** Footer close button label, defaults to ui.cancel. */
  cancelLabel?: string;
  submitDisabled?: boolean;
  saving?: boolean;
  onDelete?: () => void;
  error?: string | null;
  children: React.ReactNode;
}

/** Bottom sheet for create/edit forms: title, scrollable fields, cancel/save footer, optional delete. */
export default function FormSheet({
  visible,
  title,
  onClose,
  onSubmit,
  submitLabel,
  cancelLabel,
  submitDisabled,
  saving,
  onDelete,
  error,
  children,
}: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('ui.cancel')} />
        <SafeAreaView edges={['bottom']} className="bg-background dark:bg-background-dark rounded-t-3xl" style={{ maxHeight: '90%' }}>
          <View className="items-center pt-2">
            <View className="w-10 h-1 rounded-full bg-border dark:bg-border-dark" />
          </View>
          <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
            <Text className="text-foreground dark:text-foreground-dark text-lg font-bold flex-1">{title}</Text>
            {onDelete ? (
              <TouchableOpacity onPress={onDelete} disabled={saving}>
                <Text className="text-destructive text-sm font-semibold">{t('ui.delete')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
            {error ? <Text className="text-destructive text-sm mt-2">{error}</Text> : null}
          </KeyboardAwareScrollView>

          <View className="flex-row px-5 pb-4 pt-2" style={{ gap: 10 }}>
            <TouchableOpacity onPress={onClose} className="flex-1 border border-border dark:border-border-dark rounded-xl py-3 items-center">
              <Text className="text-foreground dark:text-foreground-dark font-semibold">{cancelLabel ?? t('ui.cancel')}</Text>
            </TouchableOpacity>
            {onSubmit ? (
              <TouchableOpacity
                onPress={onSubmit}
                disabled={submitDisabled || saving}
                className={`flex-1 bg-primary dark:bg-primary-dark rounded-xl py-3 items-center ${submitDisabled || saving ? 'opacity-50' : ''}`}
              >
                {saving ? (
                  <ActivityIndicator color={themeColors.primaryForeground} size="small" />
                ) : (
                  <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{submitLabel ?? t('ui.save')}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Labeled wrapper for a form field inside FormSheet. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-1">{label}</Text>
      {children}
    </View>
  );
}

/** Shared TextInput className so all form inputs look alike. */
export const inputClassName =
  'border border-border dark:border-border-dark bg-card dark:bg-card-dark rounded-xl px-3 py-2.5 text-foreground dark:text-foreground-dark text-sm';
