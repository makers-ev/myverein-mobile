import React from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useElevation, type Elevation } from '@/theme/elevation';

interface Props extends Omit<ViewProps, 'style'> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** `card` (default) soft shadow; `hero` tinted shadow; `flat` surface only (nested inside another card). */
  level?: Elevation | 'flat';
}

/** Classes that belong to the OUTER view when the surface clips its content (placement), the rest goes to the inner view. */
const OUTER = /^(-?m[trblxy]?-|self-|flex-1$|grow$|shrink|basis-|w-|min-w-|max-w-|absolute$|relative$|z-)/;

/**
 * The card surface: `bg-card`, radius `card` (22), a soft shadow in light mode and a lighter surface step in dark mode,
 * no border. Use it for every standalone card (content with its own actions or facts); lists of destinations belong in a
 * `ListSection`. When the content must be clipped to the rounded corners (`overflow-hidden`) the shadow lives on an outer
 * view and the clipping on an inner one, because iOS drops the shadow of a view that clips.
 */
export default function Surface({ className = '', style, level = 'card', children, ...rest }: Props) {
  const shadow = useElevation(level === 'flat' ? 'card' : level);
  const base = 'bg-card dark:bg-card-dark rounded-card';
  const elevation = level === 'flat' ? undefined : shadow;
  const classes = className.split(/\s+/).filter(Boolean);
  if (!classes.includes('overflow-hidden')) {
    return (
      <View {...rest} className={`${base} ${className}`} style={[elevation, style]}>
        {children}
      </View>
    );
  }
  const rest2 = classes.filter((c) => c !== 'overflow-hidden');
  const outer = rest2.filter((c) => OUTER.test(c.replace(/^(dark:|sm:)/, '')));
  const inner = rest2.filter((c) => !outer.includes(c));
  return (
    <View {...rest} className={`${base} ${outer.join(' ')}`} style={[elevation, style]}>
      <View className={`rounded-card overflow-hidden ${inner.join(' ')}`}>{children}</View>
    </View>
  );
}
