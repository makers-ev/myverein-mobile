import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { navigate } from '@/navigation/navigationRef';
import Button from '@/components/ui/Button';

interface Props {
  /** Hide "Verein gründen" while a registration is already running (the registration card offers "continue"). */
  hideCreate?: boolean;
}

/**
 * First step for a signed-in person without a club (Wave 14 N3): join, start one, or look around first. Used on Heute
 * and in the Verein tab, so both say the same thing. "Erst mal umschauen" opens Mehr (settings, privacy), never a dead end.
 */
export default function NoClubChoices({ hideCreate }: Props) {
  const { t } = useLanguage();
  return (
    <View className="py-2" style={{ gap: 12 }}>
      <View>
        <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-bold text-lg mb-1">
          {t('onboarding.choice.title')}
        </Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('onboarding.choice.body')}</Text>
      </View>
      <View style={{ gap: 4 }}>
        <Button label={t('onboarding.choice.join')} onPress={() => navigate('JoinClub')} accessibilityHint={t('onboarding.choice.join.hint')} />
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">{t('onboarding.choice.join.hint')}</Text>
      </View>
      {hideCreate ? null : (
        <View style={{ gap: 4 }}>
          <Button variant="secondary" label={t('onboarding.choice.create')} onPress={() => navigate('CreateClub')} accessibilityHint={t('onboarding.choice.create.hint')} />
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-2">{t('onboarding.choice.create.hint')}</Text>
        </View>
      )}
      <View style={{ gap: 4 }}>
        <Button variant="secondary" label={t('onboarding.choice.browse')} onPress={() => navigate('Mehr')} accessibilityHint={t('onboarding.choice.browse.hint')} />
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs">{t('onboarding.choice.browse.hint')}</Text>
      </View>
    </View>
  );
}
