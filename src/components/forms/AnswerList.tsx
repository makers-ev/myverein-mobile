import React from 'react';
import { Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { answerText, type RenderedAnswer } from '@/lib/applicationReview';
import { useThemeColors } from '@/theme/colors';

/**
 * Read-only list of submitted answers (exit queue). The server has already rendered them against the form version they were
 * filled in; protected answers the caller may not read arrive `redacted` and show the "Geschützt" marker instead of a value.
 * All text is applicant input and rendered as plain text, never as markup.
 */
export default function AnswerList({ answers }: { answers: readonly RenderedAnswer[] }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  return (
    <View style={{ gap: 8 }}>
      {answers.map((a) => (
        <View key={a.key} className="rounded-lg border border-border dark:border-border-dark px-3 py-2">
          <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{a.label}</Text>
          {a.redacted ? (
            <View className="flex-row items-center mt-0.5" style={{ gap: 6 }} accessible accessibilityLabel={`${a.label}: ${t('forms.review.redacted')}`}>
              <Lock size={14} color={themeColors.mutedForeground} />
              <Text className="text-sm italic text-muted-foreground dark:text-muted-foreground-dark">{t('forms.review.redacted')}</Text>
            </View>
          ) : (
            <Text
              className={`text-sm mt-0.5 ${a.answered ? 'text-foreground dark:text-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
              selectable
            >
              {answerText(a, t)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
