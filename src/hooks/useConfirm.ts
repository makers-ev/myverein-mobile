import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the confirming button (default: "OK"). */
  confirmLabel?: string;
  /** Destructive actions get the red style on iOS. */
  destructive?: boolean;
}

/**
 * Confirmation dialog as a promise (same name and shape as the website's `useConfirm`, which also returns a `dialog`
 * node there; native `Alert` needs none). Resolves `true` on confirm, `false` on cancel or dismiss.
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean> } {
  const { t } = useLanguage();
  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        Alert.alert(
          options.title,
          options.message,
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: options.confirmLabel ?? t('common.ok'), style: options.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      }),
    [t],
  );
  return { confirm };
}
