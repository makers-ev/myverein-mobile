import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

/**
 * Shared shell for the three legal screens (Privacy, Imprint, Terms of
 * Service) -- same title/notice/numbered-sections shape, just different
 * translation key prefixes, so the layout lives once instead of being
 * copy-pasted three times. `sectionCount` differs per document (Privacy and
 * ToS need more sections than the 4-section Imprint placeholder).
 */
export default function LegalDocumentLayout({ keyPrefix, sectionCount = 4 }: { keyPrefix: string; sectionCount?: number }) {
    const { t, language } = useLanguage();
    const navigation = useNavigation();
    const themeColors = useThemeColors();

    // LegalTranslation.ts is DE/EN-only by design (ADR-009, juristisch
    // geprüfter Text) -- every other language falls back to the English
    // legal text (t()'s own per-key fallback already does this silently),
    // this banner just makes that fallback visible instead of silent.
    const showLegalFallbackNotice = language !== 'de' && language !== 'en';

    return (
        <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
            <View className="flex-row items-center px-4 pt-2 pb-4">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Back"
                    className="p-2 -ml-2"
                >
                    <ChevronLeft size={24} color={themeColors.foreground} />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-lg font-bold text-foreground dark:text-foreground-dark mr-8">
                    {t(`${keyPrefix}.title`)}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {showLegalFallbackNotice && (
                    <View className="bg-muted dark:bg-muted-dark border border-border dark:border-border-dark rounded-lg p-3 mb-4">
                        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                            {t('legal.fallback-notice')}
                        </Text>
                    </View>
                )}
                <Text className="text-xs italic text-muted-foreground dark:text-muted-foreground-dark mb-6">
                    {t(`${keyPrefix}.placeholder-notice`)}
                </Text>

                {Array.from({ length: sectionCount }, (_, i) => i + 1).map((num) => (
                    <View key={num} className="mb-5">
                        <Text className="text-base font-bold text-foreground dark:text-foreground-dark mb-1">
                            {t(`${keyPrefix}.section${num}.title`)}
                        </Text>
                        <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark leading-relaxed">
                            {t(`${keyPrefix}.section${num}.text`)}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
