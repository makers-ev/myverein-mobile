import React, { Children, isValidElement, type ReactNode } from 'react';
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
 * stack of equally weighted cards. Use it for every navigation list (Mehr, Verwaltung, "Für den Vorstand"). Empty
 * children (`null`/`false`) are skipped; a section without rows renders nothing.
 */
export default function ListSection({ title, footer, inset = 16, children }: Props) {
  const rows = Children.toArray(children).filter(isValidElement);
  if (rows.length === 0) return null;
  return (
    <View className="mb-6">
      {title ? (
        <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-medium mb-2 px-1">
          {title}
        </Text>
      ) : null}
      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-[14px] overflow-hidden">
        <InListSection.Provider value={true}>
          {rows.map((row, i) => (
            <View key={row.key ?? i}>
              {i > 0 ? <View className="bg-border dark:bg-border-dark" style={{ height: 1, marginLeft: inset }} /> : null}
              {row}
            </View>
          ))}
        </InListSection.Provider>
      </View>
      {footer ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-2 px-1">{footer}</Text> : null}
    </View>
  );
}
