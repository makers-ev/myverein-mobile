import React from 'react';
import { View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { goToTab, navigationRef } from '@/navigation/navigationRef';
import IconButton from './IconButton';

/** 44pt back chevron for headerless screens (Login, Konto erstellen, Passwort zurücksetzen); falls back to Home when there is nothing to go back to. */
export default function BackButton() {
  const { t } = useLanguage();
  return (
    <View style={{ marginLeft: -8, marginBottom: 8, alignSelf: 'flex-start' }}>
      <IconButton
        icon={ChevronLeft}
        label={t('ui.back')}
        onPress={() => {
          if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
          else goToTab('Home');
        }}
      />
    </View>
  );
}
