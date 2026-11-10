import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import Button from '@/components/ui/Button';
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
  const { busy, error, choose, remove } = useMemberPhoto({ clubId, target, t, onChanged });

  return (
    <View className="mb-4">
      <View className="flex-row items-center" style={{ gap: 16 }}>
        <MemberAvatar name={name} photoUrl={photoUrl} size={72} onExpired={onPhotoExpired} />
        {readOnly ? null : (
          <View className="flex-1 flex-row flex-wrap items-center" style={{ gap: 4 }}>
            <Button variant="secondary" size="M" label={photoUrl ? t('member-photo.change') : t('member-photo.add')} onPress={choose} loading={busy} />
            {/* Removing is reversible (a new photo can be taken), so it is a quiet text action that asks first. */}
            {photoUrl ? <Button variant="tertiary" size="M" label={t('member-photo.remove')} onPress={remove} disabled={busy} /> : null}
          </View>
        )}
      </View>
      {error ? (
        <Text className="text-destructive dark:text-destructive-dark text-sm mt-2" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {hint ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-[13px] leading-[18px] mt-2">{hint}</Text> : null}
    </View>
  );
}
