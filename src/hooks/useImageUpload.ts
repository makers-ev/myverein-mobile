import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { uploadMedia, type UploadedMedia } from '@/lib/media';
import { imageUploadFailureKey } from '@/lib/memberPhoto';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface Options {
  clubId: string;
  t: Translate;
  /** Called with the uploaded file's key (+ signed preview URL) after a successful `POST /media`. */
  onUploaded: (media: UploadedMedia) => void;
}

/**
 * Pick (camera or library), upload via `POST /media` and hand the resulting storage key to the caller, who sends
 * it as `photoKey` in the feature request. Nothing is persisted here. A result arriving after the club changed,
 * the component unmounted or a newer pick started is dropped.
 */
export function useImageUpload({ clubId, t, onUploaded }: Options) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });
  useEffect(() => {
    token.current += 1;
    return () => {
      token.current += 1;
    };
  }, [clubId]);

  const run = useCallback(
    async (source: 'camera' | 'library') => {
      const my = ++token.current;
      const permission =
        source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (my !== token.current) return;
      if (!permission.granted) {
        setError(t(source === 'camera' ? 'member-photo.error.camera-permission' : 'member-photo.error.library-permission'));
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset || my !== token.current) return;

      setBusy(true);
      setError(null);
      const res = await uploadMedia(clubId, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
        fileSize: asset.fileSize,
      });
      if (my !== token.current) return;
      setBusy(false);
      if ('error' in res) {
        setError(t(imageUploadFailureKey(res.error)));
        return;
      }
      onUploadedRef.current(res.media);
    },
    [clubId, t],
  );

  const choose = useCallback(() => {
    if (busy) return;
    setError(null);
    Alert.alert(t('media.choose.title'), undefined, [
      { text: t('member-photo.choose.camera'), onPress: () => void run('camera') },
      { text: t('member-photo.choose.library'), onPress: () => void run('library') },
      { text: t('member-photo.choose.cancel'), style: 'cancel' },
    ]);
  }, [busy, run, t]);

  return { busy, error, setError, choose };
}
