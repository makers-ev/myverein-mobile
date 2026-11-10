import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import IconButton from './IconButton';
import Title from './Title';

interface Props {
  /** Large title = the tab or section name ("Heute", "Verein"), never the club name. */
  title: string;
  /** Context line above the title: the club (`<ClubSwitcher />`, tappable to switch). */
  context?: ReactNode;
  /** Muted line under the title. */
  subtitle?: string;
  /** Trailing 44pt icon buttons (search, add, more). */
  actions?: ReactNode;
  /** Inline top bar with a back button (sub-screens). Without it the large title is used. */
  onBack?: () => void;
}

/**
 * Top bar (Figma `Top bar`). Large: club context line, serif Title/L with optional actions on the same row. Inline:
 * back button + Heading/M title for sub-screens. 16pt side gutter like the content below.
 */
export default function ScreenHeader({ title, context, subtitle, actions, onBack }: Props) {
  const { t } = useLanguage();
  if (onBack) {
    return (
      <View className="flex-row items-center px-2 pt-1 pb-2" style={{ minHeight: 52 }}>
        <IconButton icon={ChevronLeft} label={t('ui.back')} onPress={onBack} />
        <Text accessibilityRole="header" numberOfLines={2} className="flex-1 text-foreground dark:text-foreground-dark text-[20px] leading-[26px] font-semibold ml-1">
          {title}
        </Text>
        {actions ? <View className="flex-row items-center">{actions}</View> : null}
      </View>
    );
  }
  return (
    <View className="px-4 pt-2 pb-3">
      {context ? <View className="mb-0.5">{context}</View> : null}
      <View className="flex-row items-end" style={{ gap: 4 }}>
        <View className="flex-1">
          <Title>{title}</Title>
        </View>
        {actions ? (
          <View className="flex-row items-center" style={{ marginRight: -10 }}>
            {actions}
          </View>
        ) : null}
      </View>
      {subtitle ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-1">{subtitle}</Text> : null}
    </View>
  );
}
