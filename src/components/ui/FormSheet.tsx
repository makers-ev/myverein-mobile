import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import Button from './Button';

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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(11,12,15,0.48)' }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('ui.cancel')} />
        <SafeAreaView edges={['bottom']} className="bg-card dark:bg-card-dark rounded-t-[20px]" style={{ maxHeight: '90%' }}>
          <View className="items-center pt-2">
            <View className="w-10 h-1 rounded-full bg-border-control dark:bg-border-control-dark" />
          </View>
          <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
            <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold flex-1">{title}</Text>
            {onDelete ? (
              <TouchableOpacity
                onPress={onDelete}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={t('ui.delete')}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text className="text-destructive dark:text-destructive-dark text-sm font-semibold">{t('ui.delete')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
            {error ? <Text className="text-destructive dark:text-destructive-dark text-sm mt-2">{error}</Text> : null}
          </KeyboardAwareScrollView>

          <View className="flex-row px-5 pb-4 pt-3 border-t border-border dark:border-border-dark" style={{ gap: 10 }}>
            <View className="flex-1">
              <Button block variant="secondary" label={cancelLabel ?? t('ui.cancel')} onPress={onClose} />
            </View>
            {onSubmit ? (
              <View className="flex-1">
                <Button block label={submitLabel ?? t('ui.save')} onPress={onSubmit} disabled={submitDisabled} loading={saving} />
              </View>
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
      <Text className="text-foreground dark:text-foreground-dark text-[13px] leading-[18px] font-medium mb-1.5">{label}</Text>
      {children}
    </View>
  );
}

/** Shared TextInput className so all form inputs look alike. */
export const inputClassName =
  'border border-border-control dark:border-border-control-dark bg-card dark:bg-card-dark rounded-[10px] px-3 py-3 min-h-[48px] text-foreground dark:text-foreground-dark text-[17px]';
