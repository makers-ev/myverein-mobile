import React, { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/** Short fade + slide on mount; `delay` staggers siblings. Skips motion when reduce-motion is on. */
export default function FadeIn({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    let anim: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        v.setValue(1);
        return;
      }
      anim = Animated.timing(v, { toValue: 1, duration: 300, delay, useNativeDriver: true });
      anim.start();
    });
    return () => {
      cancelled = true;
      anim?.stop();
    };
  }, [v, delay]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}
