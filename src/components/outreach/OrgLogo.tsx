import React from 'react';
import { View } from 'react-native';

import Avatar from '@/components/ui/Avatar';
import SignedImage from '@/components/ui/SignedImage';

/**
 * Logo of a club or sponsor (Wave 15): the image comes from the media layer (a short-lived signed URL, or the unsigned URL
 * of a file the club released publicly), never from a typed link. Initials stand in while there is no logo or it fails to
 * load. Decorative: the name always stands next to it. `onExpired` lets the owner refetch for a fresh signature.
 */
export default function OrgLogo({ name, uri, size = 40, onExpired }: { name: string; uri?: string | null; size?: 40 | 72; onExpired?: () => void }) {
  const initials = <Avatar name={name} size={size === 72 ? 'L' : 'M'} tone="accent" />;
  if (!uri) return initials;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="rounded-full overflow-hidden" style={{ width: size, height: size }}>
      <SignedImage uri={uri} style={{ width: size, height: size }} fallback={initials} onExpired={onExpired} />
    </View>
  );
}
