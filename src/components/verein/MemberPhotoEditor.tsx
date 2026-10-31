import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { useMemberPhoto } from '@/hooks/useMemberPhoto';
import type { ClubMember } from '@/hooks/useClubMembers';
import MemberAvatar from './MemberAvatar';

interface Props {
  clubId: string;
  /** `'me'` or the `club_members.id` of another member. */
  target: string;
  name: string | null;
  photoUrl: string | null | undefined;
  /** Optional explanatory line below the buttons (e.g. "the board sets photos of minors"). */
  hint?: string;
  /** Own photo of a minor: no edit controls, only the hint. */
  readOnly?: boolean;
  onChanged: (member: ClubMember | null, target: string) => void;
  onPhotoExpired?: () => void;
}

/** Avatar plus "take / choose photo" and "remove" actions (two taps to change, three to remove). */
export default function MemberPhotoEditor({ clubId, target, name, photoUrl, hint, readOnly, onChanged, onPhotoExpired }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { busy, error, choose, remove } = useMemberPhoto({ clubId, target, t, onChanged });

  return (
    <View className="mb-4">
      <View className="flex-row items-center" style={{ gap: 16 }}>
        <MemberAvatar name={name} photoUrl={photoUrl} size={72} onExpired={onPhotoExpired} />
        {readOnly ? null : (
          <View className="flex-1" style={{ gap: 8 }}>
            <TouchableOpacity
              className={`bg-primary dark:bg-primary-dark rounded-xl px-4 items-center justify-center ${busy ? 'opacity-50' : ''}`}
              style={{ minHeight: 44 }}
              onPress={choose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              accessibilityLabel={photoUrl ? t('member-photo.change') : t('member-photo.add')}
            >
              {busy ? (
                <ActivityIndicator color={themeColors.primaryForeground} />
              ) : (
                <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
                  {photoUrl ? t('member-photo.change') : t('member-photo.add')}
                </Text>
              )}
            </TouchableOpacity>
            {photoUrl ? (
              <TouchableOpacity
                className={`rounded-xl px-4 items-center justify-center border border-border dark:border-border-dark ${busy ? 'opacity-50' : ''}`}
                style={{ minHeight: 44 }}
                onPress={remove}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('member-photo.remove')}
              >
                <Text className="text-destructive dark:text-destructive-dark text-sm font-semibold">{t('member-photo.remove')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
      {error ? (
        <Text className="text-destructive dark:text-destructive-dark text-sm mt-2" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-2">{hint}</Text> : null}
    </View>
  );
}
