import React from 'react';
import { Image, Text, View } from 'react-native';

interface LogoProps {
  /** Pixel size of the square mark. Defaults to a size legible in a header. */
  size?: number;
  /** Hide the "LPJ IT-Solutions" wordmark and render just the mark. */
  hideWordmark?: boolean;
}

/**
 * React Native port of the website's `src/components/Logo.tsx`. The web
 * version points an <img> at the SVG directly; RN's Image (and Metro) can't
 * load SVGs without an extra transformer, so this points at the same
 * rasterized mark already bundled as the app icon (assets/icon.png) instead
 * of adding an SVG dependency for one static image.
 */
export default function Logo({ size = 40, hideWordmark = false }: LogoProps) {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require('../../assets/icon.png')}
        style={{ width: size, height: size, borderRadius: size * 0.2 }}
        accessibilityLabel="LPJ IT-Solutions"
      />
      {!hideWordmark && (
        <Text className="text-xl font-bold tracking-tight text-foreground dark:text-foreground-dark">
          LPJ IT-Solutions
        </Text>
      )}
    </View>
  );
}
