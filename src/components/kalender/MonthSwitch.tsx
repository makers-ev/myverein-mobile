import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { shiftMonth } from '@/lib/timeTracking';

interface Props {
  month: Date;
  onChange: (month: Date) => void;
}

/** Previous / next month switch for the hours sheets. The next month is not offered past the current one. */
export default function MonthSwitch({ month, onChange }: Props) {
  const { t, language } = useLanguage();
  const colors = useThemeColors();
  const current = shiftMonth(new Date(), 0);
  const atCurrent = month.getTime() >= current.getTime();
  return (
    <View className="flex-row items-center justify-between mb-3">
      <TouchableOpacity
        onPress={() => onChange(shiftMonth(month, -1))}
        accessibilityRole="button"
        accessibilityLabel={t('time.month.prev')}
        className="items-center justify-center"
        style={{ minHeight: 44, minWidth: 44 }}
      >
        <ChevronLeft size={20} color={colors.foreground} />
      </TouchableOpacity>
      <Text className="text-foreground dark:text-foreground-dark font-bold text-sm" accessibilityLiveRegion="polite">
        {month.toLocaleDateString(language, { month: 'long', year: 'numeric' })}
      </Text>
      <TouchableOpacity
        onPress={() => onChange(shiftMonth(month, 1))}
        disabled={atCurrent}
        accessibilityRole="button"
        accessibilityLabel={t('time.month.next')}
        accessibilityState={{ disabled: atCurrent }}
        className={`items-center justify-center ${atCurrent ? 'opacity-40' : ''}`}
        style={{ minHeight: 44, minWidth: 44 }}
      >
        <ChevronRight size={20} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}
