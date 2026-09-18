import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/translation/LanguageContext';

const SECTION_COUNT = 8;

interface AcceptTosModalProps {
    visible: boolean;
    onAccept: () => void;
}

/**
 * Blocking first-launch consent screen -- same shape as mycollection-app's
 * AcceptToSModal (checkbox gates the Accept button), reusing the same
 * placeholder content as TermsOfServiceScreen (`legal.tos.*`) rather than a
 * separate copy, so there is exactly one place that defines what the ToS
 * text actually says.
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
export default function AcceptTosModal({ visible, onAccept }: AcceptTosModalProps) {
    const { t } = useLanguage();
    const [isChecked, setIsChecked] = useState(false);
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const navbarClearance = Math.max(insets.bottom + 12, 24) + 64 + 12;
    const topClearance = insets.top + 12;
    const maxCardHeight = Math.min(windowHeight * 0.85, windowHeight - topClearance - navbarClearance);

    const handleAccept = () => {
        if (!isChecked) return;
        setIsChecked(false);
        onAccept();
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={() => {}}>
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <View
                    className="bg-card dark:bg-card-dark rounded-3xl px-6 pt-6 pb-8"
                    style={{ marginHorizontal: 16, marginBottom: navbarClearance, maxHeight: maxCardHeight }}
                >
                    <Text className="text-2xl font-black text-foreground dark:text-foreground-dark mb-4">
                        {t('legal.tos.title')}
                    </Text>

                    <ScrollView
                        className="bg-muted dark:bg-muted-dark rounded-2xl p-4 border border-border dark:border-border-dark mb-6"
                        style={{ maxHeight: 320 }}
                    >
                        {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map((num) => (
                            <View key={num} className="mb-4">
                                <Text className="font-bold text-foreground dark:text-foreground-dark mb-1">
                                    {t(`legal.tos.section${num}.title`)}
                                </Text>
                                <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark leading-relaxed">
                                    {t(`legal.tos.section${num}.text`)}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setIsChecked(!isChecked)}
                        className="flex-row items-center mb-6"
                    >
                        <View
                            className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
                                isChecked
                                    ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark'
                                    : 'bg-background dark:bg-background-dark border-border dark:border-border-dark'
                            }`}
                        >
                            {isChecked && (
                                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-xs font-black">
                                    ✓
                                </Text>
                            )}
                        </View>
                        <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">
                            {t('tos_modal.checkbox')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        disabled={!isChecked}
                        onPress={handleAccept}
                        className={`py-4 rounded-xl items-center ${
                            isChecked ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'
                        }`}
                    >
                        <Text
                            className={`font-bold text-base ${
                                isChecked
                                    ? 'text-primary-foreground dark:text-primary-foreground-dark'
                                    : 'text-muted-foreground dark:text-muted-foreground-dark'
                            }`}
                        >
                            {t('tos_modal.accept')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
