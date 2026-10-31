import React from 'react';
import { View } from 'react-native';

import { useMyClubs } from '@/hooks/useMyClubs';
import ErrorState from '@/components/ui/ErrorState';

/** Error state for a failed `/my-clubs` load (distinct from "no club yet"), with retry. */
export default function ClubsLoadError() {
  const { refetch } = useMyClubs();
  return (
    <View className="px-6 pt-6">
      <ErrorState fallbackKey="club-switcher.error" onRetry={() => void refetch()} />
    </View>
  );
}
