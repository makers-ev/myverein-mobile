import React, { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

interface Props extends Omit<PressableProps, 'style'> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (default 0.98); 1 disables the scale and only dims. */
  scale?: number;
}

/**
 * Pressable with the app's one press feedback: a tiny scale down while the finger is on it (no animation, so nothing
 * to switch off for reduce motion). Takes a plain `style` (a style function would drop the NativeWind `className`).
 */
export default function PressScale({ scale = 0.98, style, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, pressed ? { transform: [{ scale }] } : null]}
    />
  );
}
