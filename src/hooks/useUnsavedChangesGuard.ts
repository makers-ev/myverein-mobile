import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useLanguage } from '@/contexts/translation/LanguageContext';

/**
 * "Discard draft?" guard (Wave 14 N4): while `dirty` is true, leaving the screen (header back, swipe back, Android back,
 * tab bar) asks first and only continues when the person confirms. Reset actions pass without a dialog. Nothing is asked when the form is clean, so a saved
 * form leaves silently. Uses the native-stack `beforeRemove` event, so it needs no wiring in the navigator.
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  const navigation = useNavigation();
  const { t } = useLanguage();
  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (e) => {
      // A reset (sign-out, session ended, account deleted) is not the person leaving: never block it with a dialog.
      if (e.data.action.type === 'RESET') return;
      e.preventDefault();
      Alert.alert(t('profil.discard.title'), t('profil.discard.message'), [
        { text: t('profil.discard.keep'), style: 'cancel' },
        { text: t('profil.discard.confirm'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [dirty, navigation, t]);
}
