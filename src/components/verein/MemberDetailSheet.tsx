import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import FormSheet from '@/components/ui/FormSheet';
import type { ClubMember } from '@/hooks/useClubMembers';
import { isMinorBirthDate } from '@/lib/memberPhoto';
import MemberPhotoEditor from './MemberPhotoEditor';
import MemberAvatar from './MemberAvatar';
import MemberCustomFields from './MemberCustomFields';

/** Display name of a member's category: backend name first, the key as fallback. */
export function categoryLabel(member: ClubMember): string | null {
  return member.categoryName ?? member.categoryObject?.name ?? member.category;
}

/** `YYYY-MM-DD` -> local date, without the UTC shift `new Date('YYYY-MM-DD')` would introduce. */
export function formatDay(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(locale);
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View className="py-2 border-b border-border dark:border-border-dark" accessible accessibilityLabel={`${label}: ${value}`}>
      <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold mb-0.5">{label}</Text>
      <Text className="text-foreground dark:text-foreground-dark text-sm">{value}</Text>
    </View>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <Text className="text-foreground dark:text-foreground-dark font-bold text-sm mt-4 mb-1" accessibilityRole="header">
      {children}
    </Text>
  );
}

interface Props {
  member: ClubMember | null;
  onClose: () => void;
  clubId: string;
  /** `members:write`: may set/remove the member's photo (`PUT/DELETE /club-members/:id/photo`). */
  canEditPhoto?: boolean;
  /** The photo was set (`ClubMember`) or removed (`null`); the owner refreshes its list. */
  onPhotoChanged?: (member: ClubMember | null, memberId: string) => void;
  /** The shown photo URL failed to load (expired signature): the owner refetches the resource. */
  onPhotoExpired?: () => void;
  /** `members:write`: shows the member's custom fields (read-only; the board edits them on the website). The server filters by visibility. */
  showCustomFields?: boolean;
  /** The caller has `members:read_sensitive`; without it a note says protected fields are not shown. */
  canReadSensitive?: boolean;
}

/**
 * Member detail. Profile data is read-only here (create/edit/import stay on
 * the website); the one write action is the photo, for `members:write`. Shows
 * only what the list delivered -- sensitive fields that are `undefined` (no
 * members:read_sensitive) or empty are not rendered. The custom fields (Wave 8 M4)
 * are loaded separately and shown read-only for `members:write`.
 */
export default function MemberDetailSheet({ member, onClose, clubId, canEditPhoto, onPhotoChanged, onPhotoExpired, showCustomFields, canReadSensitive }: Props) {
  const { t, language } = useLanguage();

  if (!member) return <FormSheet visible={false} title="" onClose={onClose}>{null}</FormSheet>;

  const address = [member.street, [member.postalCode, member.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const activeDepartments = member.departments.filter((d) => d.until === null);
  const endedDepartments = member.departments.filter((d) => d.until !== null);
  const emergency = [member.emergencyContactName, member.emergencyContactPhone].filter(Boolean).join(', ');

  return (
    <FormSheet visible title={member.name ?? '—'} onClose={onClose} cancelLabel={t('verein.members.close')}>
      {canEditPhoto ? (
        <MemberPhotoEditor
          // Fresh hook state per member: an upload in flight must not leak into the next sheet.
          key={member.id}
          clubId={clubId}
          target={member.id}
          name={member.name}
          photoUrl={member.photoUrl}
          hint={isMinorBirthDate(member.birthDate) ? t('member-photo.board-minor-hint') : t('member-photo.board-hint')}
          onChanged={(m, id) => onPhotoChanged?.(m, id)}
          onPhotoExpired={onPhotoExpired}
        />
      ) : member.photoUrl ? (
        <View className="mb-3 items-start">
          <MemberAvatar name={member.name} photoUrl={member.photoUrl} size={72} onExpired={onPhotoExpired} />
        </View>
      ) : null}
      <Row label={t('verein.members.status')} value={t(`verein.status.${member.effectiveStatus}`)} />
      <Row label={t('verein.members.category')} value={categoryLabel(member)} />
      <Row label={t('verein.members.account')} value={member.hasAccount ? t('verein.members.account.yes') : t('verein.members.account.no')} />
      <Row label={t('verein.members.member-number')} value={member.memberNumber} />
      <Row label={t('verein.members.joined')} value={formatDay(member.joinedAt, language)} />
      <Row label={t('verein.members.left')} value={formatDay(member.leftAt, language)} />

      <Heading>{t('verein.members.departments')}</Heading>
      {activeDepartments.length === 0 && endedDepartments.length === 0 ? (
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm">{t('verein.members.departments.empty')}</Text>
      ) : (
        <>
          {activeDepartments.map((d) => (
            <Row key={d.id} label={d.name} value={t('verein.members.since', { date: formatDay(d.since, language) ?? '—' })} />
          ))}
          {endedDepartments.map((d) => (
            <Row
              key={d.id}
              label={d.name}
              value={t('verein.members.ended', { from: formatDay(d.since, language) ?? '—', to: formatDay(d.until, language) ?? '—' })}
            />
          ))}
        </>
      )}

      {member.roles.length > 0 ? (
        <>
          <Heading>{t('verein.members.roles')}</Heading>
          <Text className="text-foreground dark:text-foreground-dark text-sm">{member.roles.map((r) => t(`verein.role.${r.roleType}`)).join(', ')}</Text>
        </>
      ) : null}

      {member.birthDate || address || member.phone || member.email || member.contactEmail || emergency ? (
        <>
          <Heading>{t('verein.members.contact')}</Heading>
          <Row label={t('profil.birth-date')} value={formatDay(member.birthDate, language)} />
          <Row label={t('verein.members.address')} value={address} />
          <Row label={t('profil.phone')} value={member.phone} />
          <Row label={t('verein.members.account-email')} value={member.email} />
          <Row label={t('profil.contact-email')} value={member.contactEmail} />
          <Row label={t('profil.section.emergency')} value={emergency} />
        </>
      ) : null}

      {showCustomFields ? (
        // Fresh hook state per member: values of one person must never show on another's sheet.
        <MemberCustomFields key={member.id} clubId={clubId} target={member.id} readOnlyView showSensitiveNote={!canReadSensitive} />
      ) : null}
    </FormSheet>
  );
}
