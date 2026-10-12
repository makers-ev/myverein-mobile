import React, { useEffect, useRef, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

interface Props {
  /** Signed, short-lived URL delivered by the API (`photoUrl`); never persisted by callers. */
  uri: string;
  className?: string;
  style?: StyleProp<ImageStyle>;
  /** Rendered when the image failed to load again after a refresh (default: nothing). */
  fallback?: React.ReactNode;
  /**
   * Called once per failure streak when the image fails to load (typically an expired signature); the owner
   * refetches the resource, which delivers a fresh URL. A fresh URL that fails too shows `fallback`.
   */
  onExpired?: () => void;
}

/** Plain `Image` for signed media URLs (no cookie needed) with a one-shot "URL expired" signal. */
export default function SignedImage({ uri, className, style, fallback = null, onExpired }: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const retried = useRef(false);
  const onExpiredRef = useRef(onExpired);
  useEffect(() => {
    onExpiredRef.current = onExpired;
  });

  if (failedUri === uri) return <>{fallback}</>;
  return (
    <Image
      source={{ uri }}
      className={className}
      style={style}
      resizeMode="cover"
      onLoad={() => {
        retried.current = false;
      }}
      onError={() => {
        setFailedUri(uri);
        if (!retried.current) {
          retried.current = true;
          onExpiredRef.current?.();
        }
      }}
    />
  );
}
