import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rocket, ShieldCheck, Settings2 } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

const STEPS = [
  { icon: Rocket, key: 'step1' },
  { icon: ShieldCheck, key: 'step2' },
  { icon: Settings2, key: 'step3' },
] as const;

interface IntroModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * First-launch "what is this app" walkthrough -- shown once, after the ToS
 * modal (see HomeScreen.tsx), tracked via `introSeenStorage.ts`. Same
 * hand-rolled bottom-sheet shell as `legal/AcceptTosModal.tsx` rather than a
 * new generic dialog component, since this is the only other place in the
 * template that needs one. Steps are deliberately generic ("Create your
 * account", "Explore Settings") -- swap them for your app's real
 * first-steps once there's a real product behind this template.
 *
 * Floating card with `marginBottom` clearing the floating pill navbar below it.
 *
 * Max height is computed from the window height rather than a flat `85%`:
 * on shorter devices, `85%` plus `navbarClearance` can exceed the screen
 * height, pushing the card's top edge above `y = 0` (behind the status
 * bar/notch) since the container is `justify-end` and RN doesn't clip
 * overflowing flex children. Bounding it by the actual space between the
 * top inset and the navbar clearance keeps the whole card on-screen
 * everywhere.
 */
export default function IntroModal({ visible, onClose }: IntroModalProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navbarClearance = Math.max(insets.bottom + 12, 24) + 64 + 12;
  const topClearance = insets.top + 12;
  const maxCardHeight = Math.min(windowHeight * 0.85, windowHeight - topClearance - navbarClearance);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <TouchableOpacity className="flex-1" onPress={onClose} activeOpacity={1} />
        <View
          className="bg-card dark:bg-card-dark rounded-3xl px-6 pt-6 pb-8"
          style={{ marginHorizontal: 16, marginBottom: navbarClearance, maxHeight: maxCardHeight }}
        >
          <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-4">
            {t('intro-modal.title')}
          </Text>

          <ScrollView style={{ maxHeight: 360 }}>
            <Text className="text-muted-foreground dark:text-muted-foreground-dark mb-4">
              {t('intro-modal.intro')}
            </Text>
            {STEPS.map(({ icon: Icon, key }) => (
              <View key={key} className="flex-row mb-4" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10 dark:bg-primary-dark/15">
                  <Icon size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground dark:text-foreground-dark font-bold mb-0.5">
                    {t(`intro-modal.${key}.title`)}
                  </Text>
                  <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm leading-relaxed">
                    {t(`intro-modal.${key}.text`)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity className="bg-primary dark:bg-primary-dark rounded-xl py-3.5 items-center mt-2" onPress={onClose}>
            <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">
              {t('intro-modal.button')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
