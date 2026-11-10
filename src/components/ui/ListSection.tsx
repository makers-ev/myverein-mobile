import React, { Children, isValidElement, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { InListSection } from './ListRow';

interface Props {
  /** Section header (Label/S, muted, sentence case). */
  title?: string;
  /** Small note under the section (Caption, muted). */
  footer?: string;
  /** Left inset of the dividers: 16 for plain rows, 60 when the rows have a leading icon. */
  inset?: number;
  children: ReactNode;
}

/**
 * Grouped inset list (Figma `ListSection`): one card surface with hairline dividers between its rows, instead of a
 * stack of equally weighted cards. Use it for every navigation list (Mehr, Verwaltung, "Für den Vorstand").
 * Each `ListRow` draws its own divider above it; the first one is clipped, so entries that decide themselves whether
 * they render (permission-gated entries returning `null`) never leave a stray line. A section whose rows all render
 * nothing collapses completely (title included).
 */
export default function ListSection({ title, footer, inset = 16, children }: Props) {
  const rows = Children.toArray(children).filter(isValidElement);
  const [empty, setEmpty] = useState(false);
  if (rows.length === 0) return null;
  return (
    <View className={empty ? '' : 'mb-6'}>
      {title && !empty ? (
        <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 px-1">
          {title}
        </Text>
      ) : null}
      <View className={empty ? '' : 'bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] overflow-hidden'}>
        <View style={{ marginTop: -1 }} onLayout={(e) => setEmpty(e.nativeEvent.layout.height <= 1)}>
          <InListSection.Provider value={inset}>{rows}</InListSection.Provider>
        </View>
      </View>
      {footer && !empty ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-2 px-1">{footer}</Text> : null}
    </View>
  );
}
