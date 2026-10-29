import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';

interface Props {
  title: string;
  /** One sentence that says what to do next. */
  hint?: string;
  /** The next action, usually a `Button`. */
  action?: ReactNode;
}

/** Designed empty state: what is missing, what to do about it. Same name and props as the website's `EmptyState`. */
export default function EmptyState({ title, hint, action }: Props) {
  return (
    <View accessible accessibilityLabel={hint ? `${title}. ${hint}` : title} className="py-6">
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{title}</Text>
      {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm mb-3">{hint}</Text> : null}
      {action ? <View className="self-start">{action}</View> : null}
    </View>
  );
}
