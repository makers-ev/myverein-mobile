import React, { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

/** Up to two initials of a display name; `?` when there is no name. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0]!)[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1]!)[0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface Props {
  name: string | null | undefined;
  /** Signed, short-lived URL from the member resource; `null`/`undefined` = initials. Never persisted by callers. */
  photoUrl?: string | null;
  size?: number;
  /**
   * Called when the image failed to load although a URL was delivered (typically an expired signature).
   * Fired once per failure streak: the owner refetches the member resource, which delivers a fresh URL.
   * If the fresh URL fails too, the initials stay.
   */
  onExpired?: () => void;
}

/** Round profile picture with an initials fallback. Plain `Image` -- signed URLs need no cookie. */
export default function MemberAvatar({ name, photoUrl, size = 40, onExpired }: Props) {
  // The URL that failed to load; a new URL (fresh signature or changed photo) gets a new chance by comparison.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const retried = useRef(false);
  const onExpiredRef = useRef(onExpired);
  useEffect(() => {
    onExpiredRef.current = onExpired;
  });

  const showImage = !!photoUrl && failedUrl !== photoUrl;
  const radius = size / 2;

  return (
    <View
      className="bg-primary/10 dark:bg-primary-dark/10 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ?? undefined}
    >
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
          onLoad={() => {
            retried.current = false;
          }}
          onError={() => {
            setFailedUrl(photoUrl ?? null);
            if (!retried.current) {
              retried.current = true;
              onExpiredRef.current?.();
            }
          }}
        />
      ) : (
        <Text className="text-primary dark:text-primary-dark font-bold" style={{ fontSize: size * 0.38 }} importantForAccessibility="no">
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
