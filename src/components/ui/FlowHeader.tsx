import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import IconButton from './IconButton';
import Title from './Title';

interface Props {
  title: string;
  /** Small line above the title, e.g. "Schritt 1 von 3 · Vereinsdaten". */
  eyebrow?: string;
  /** Muted explanation under the title. */
  description?: string;
  onBack?: () => void;
  /** Rendered between title and description (step progress). */
  children?: ReactNode;
}

/**
 * Header of a full-screen flow without a stack header (Verein beitreten / gründen): 44pt back button, optional eyebrow,
 * left-aligned bold title and a muted description. 16pt side gutter like the content below.
 */
export default function FlowHeader({ title, eyebrow, description, onBack, children }: Props) {
  const { t } = useLanguage();
  return (
    <View className="px-4 pb-4">
      {onBack ? (
        <View style={{ marginLeft: -8 }}>
          <IconButton icon={ChevronLeft} label={t('ui.back')} onPress={onBack} />
        </View>
      ) : null}
      {eyebrow ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mb-0.5">{eyebrow}</Text> : null}
      <Title>{title}</Title>
      {children}
      {description ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[15px] leading-[22px] mt-1">{description}</Text> : null}
    </View>
  );
}
