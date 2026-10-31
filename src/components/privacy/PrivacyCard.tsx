import React from 'react';
import { Text, View } from 'react-native';

/** Card used by the sections of "Mein Datenschutz". */
export default function PrivacyCard({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
      <Text accessibilityRole="header" className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">
        {title}
      </Text>
      {intro ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{intro}</Text> : null}
      {children}
    </View>
  );
}
