import React, { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, Ellipsis, Users, type LucideIcon } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import Button from '@/components/ui/Button';

const STEPS: { icon: LucideIcon; key: 'step1' | 'step2' | 'step3' }[] = [
  { icon: CalendarCheck, key: 'step1' },
  { icon: Users, key: 'step2' },
  { icon: Ellipsis, key: 'step3' },
];

interface IntroModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * First-launch introduction (Wave 14 N3): at most three cards, one per tab idea (Heute, Kalender/Mitteilungen/Verein,
 * Mehr), always skippable. Shown once after the ToS (see HomeScreen.tsx, tracked via `introSeenStorage.ts`) and
 * replayable from Settings. Floating card with `marginBottom` clearing the tab bar below it; its height is bounded by the
 * window so it stays on screen on short devices.
 */
export default function IntroModal({ visible, onClose }: IntroModalProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const navbarClearance = Math.max(insets.bottom + 12, 24) + 64 + 12;
  const topClearance = insets.top + 12;
  const maxCardHeight = Math.min(windowHeight * 0.85, windowHeight - topClearance - navbarClearance);

  // Start from the first card every time the modal opens (replay from Settings).
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const step = STEPS[index]!;
  const Icon = step.icon;
  const last = index === STEPS.length - 1;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <TouchableOpacity className="flex-1" onPress={onClose} activeOpacity={1} accessibilityElementsHidden importantForAccessibility="no" />
        <View
          accessibilityViewIsModal
          className="bg-card dark:bg-card-dark rounded-3xl px-6 pt-6 pb-6"
          style={{ marginHorizontal: 16, marginBottom: navbarClearance, maxHeight: maxCardHeight }}
        >
          <Text accessibilityRole="header" className="text-2xl font-black text-foreground dark:text-foreground-dark mb-1">
            {t('onboarding.intro.title')}
          </Text>
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-4">
            {t('onboarding.intro.progress', { current: index + 1, total: STEPS.length })}
          </Text>

          <View className="flex-row mb-5" style={{ gap: 12 }}>
            <View className="w-12 h-12 rounded-full items-center justify-center bg-primary/10 dark:bg-primary-dark/15">
              <Icon size={22} color={themeColors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t(`onboarding.intro.${step.key}.title`)}</Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm leading-relaxed">{t(`onboarding.intro.${step.key}.text`)}</Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Button label={last ? t('onboarding.intro.done') : t('onboarding.intro.next')} onPress={() => (last ? onClose() : setIndex(index + 1))} />
            {last ? null : <Button variant="secondary" label={t('onboarding.intro.skip')} onPress={onClose} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}
