import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { apiFetch } from '@/lib/api';
import { photoFailureKey } from '@/lib/memberPhoto';
import { uploadMemberPhoto } from '@/lib/media';
import type { ClubMember } from './useClubMembers';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Options {
  clubId: string;
  /** `'me'` = own photo (`/club-members/me/photo`), otherwise the `club_members.id` of another member (board, `members:write`). */
  target: string;
  t: Translate;
  /** Called after a successful set (with the updated member shape incl. fresh `photoUrl`) or remove (`null`). */
  onChanged: (member: ClubMember | null, target: string) => void;
}

/**
 * Pick/take, upload and remove a profile photo.
 *
 * Square crop + upright rotation come from the picker's own editor
 * (`allowsEditing` + `aspect: [1, 1]`, which bakes the orientation into the
 * pixels and re-encodes), so no separate image-manipulation dependency is
 * needed; the backend strips EXIF/GPS and does not re-encode. Only the newest
 * action may write state: a result arriving after the club/target changed or a
 * newer action started is dropped (`token`).
 */
export function useMemberPhoto({ clubId, target, t, onChanged }: Options) {
  // Busy/error belong to the club+member they started for, so a switch never shows another member's state.
  const scope = `${clubId}|${target}`;
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ scope: string; text: string } | null>(null);
  const busy = busyScope === scope;
  const error = errorState?.scope === scope ? errorState.text : null;
  const setBusy = useCallback((value: boolean) => setBusyScope(value ? scope : null), [scope]);
  const setError = useCallback((text: string | null) => setErrorState(text ? { scope, text } : null), [scope]);
  const token = useRef(0);
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  // Switching club/member invalidates anything in flight (the editor is also keyed per member, belt and braces).
  useEffect(() => {
    token.current += 1;
    return () => {
      token.current += 1;
    };
  }, [clubId, target]);

  const failureText = useCallback((err: unknown) => t(photoFailureKey(err, target === 'me')), [t, target]);

  const runPicker = useCallback(
    async (source: 'camera' | 'library') => {
      // Taken before the picker opens: leaving the screen or switching club/member while it is open invalidates this run.
      const my = ++token.current;
      const permission =
        source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (my !== token.current) return;
      if (!permission.granted) {
        setError(t(source === 'camera' ? 'member-photo.error.camera-permission' : 'member-photo.error.library-permission'));
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset || my !== token.current) return;

      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!ALLOWED_TYPES.includes(mimeType)) {
        setError(t('member-photo.error.type'));
        return;
      }

      if (my !== token.current) return;
      setBusy(true);
      setError(null);
      const res = await uploadMemberPhoto<ClubMember>(clubId, target, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: mimeType,
        fileSize: asset.fileSize,
      });
      if (my !== token.current) return;
      setBusy(false);
      if ('error' in res) {
        setError(failureText(res.error));
        return;
      }
      onChangedRef.current(res.member, target);
    },
    [clubId, target, t, failureText, setBusy, setError],
  );

  const choose = useCallback(() => {
    if (busy) return;
    setError(null);
    Alert.alert(t('member-photo.choose.title'), undefined, [
      { text: t('member-photo.choose.camera'), onPress: () => void runPicker('camera') },
      { text: t('member-photo.choose.library'), onPress: () => void runPicker('library') },
      { text: t('member-photo.choose.cancel'), style: 'cancel' },
    ]);
  }, [busy, runPicker, t, setError]);

  const remove = useCallback(() => {
    if (busy) return;
    Alert.alert(t('member-photo.remove.title'), t('member-photo.remove.message'), [
      { text: t('member-photo.choose.cancel'), style: 'cancel' },
      {
        text: t('member-photo.remove.confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const my = ++token.current;
            setBusy(true);
            setError(null);
            try {
              await apiFetch(`/club-members/${encodeURIComponent(target)}/photo?clubId=${encodeURIComponent(clubId)}`, { method: 'DELETE' });
              if (my !== token.current) return;
              setBusy(false);
              onChangedRef.current(null, target);
            } catch (err) {
              if (my !== token.current) return;
              setBusy(false);
              setError(failureText(err));
            }
          })();
        },
      },
    ]);
  }, [busy, clubId, target, t, failureText, setBusy, setError]);

  return { busy, error, choose, remove };
}
