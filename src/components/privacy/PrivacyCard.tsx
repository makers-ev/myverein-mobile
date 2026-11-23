import React from 'react';
import { Text, View } from 'react-native';
import Surface from '@/components/ui/Surface';

/** Section of "Mein Datenschutz": muted section title and intro above, the content on one card surface. */
export default function PrivacyCard({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text accessibilityRole="header" className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] font-semibold mb-1 px-1">
        {title}
      </Text>
      {intro ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mb-2 px-1">{intro}</Text> : null}
      <Surface className="p-4">{children}</Surface>
    </View>
  );
}
