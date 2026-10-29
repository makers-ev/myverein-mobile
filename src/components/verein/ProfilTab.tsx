import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { navigate } from '@/navigation/navigationRef';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import { Field, inputClassName } from '@/components/ui/FormSheet';
import { isMinorBirthDate } from '@/lib/memberPhoto';
import { type NameErrors, nameDraftFromMember, nameFieldErrorsFromApi, namePatch, validateName } from '@/lib/memberName';
import AbsenceSection from '@/components/privacy/AbsenceSection';
import ConsentsSection from '@/components/privacy/ConsentsSection';
import { MyDocumentsEntry } from '@/components/documents/DocumentsEntry';
import ChildrenCustomFields from './ChildrenCustomFields';
import ExitRequestSection from './ExitRequestSection';
import MemberCustomFields from './MemberCustomFields';
import MemberPhotoEditor from './MemberPhotoEditor';

interface Props {
  clubId: string;
  /** Reports whether there are unsaved inputs, so the parent can guard leaving the tab. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface Draft {
  firstName: string;
  lastName: string;
  displayName: string;
  birthDate: Date | null;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  contactEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

type TextKey = Exclude<keyof Draft, 'birthDate'>;
const NAME_FIELD_KEYS = ['firstName', 'lastName', 'displayName'] as const;
const TEXT_KEYS: readonly TextKey[] = ['firstName', 'lastName', 'displayName', 'street', 'postalCode', 'city', 'phone', 'contactEmail', 'emergencyContactName', 'emergencyContactPhone'];

const EMPTY_DRAFT: Draft = {
  firstName: '',
  lastName: '',
  displayName: '',
  birthDate: null,
  street: '',
  postalCode: '',
  city: '',
  phone: '',
  contactEmail: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<'postalCode' | 'contactEmail', string>>;

function validate(draft: Draft, t: (key: string) => string): FieldErrors {
  const errors: FieldErrors = {};
  const plz = draft.postalCode.trim();
  if (plz && (plz.length < 3 || plz.length > 12)) errors.postalCode = t('profil.error.postal-code');
  const mail = draft.contactEmail.trim();
  if (mail && (mail.length > 320 || !EMAIL_PATTERN.test(mail))) errors.contactEmail = t('profil.error.email');
  return errors;
}

/**
 * Self-service edit of the fields a member is allowed to change themselves
 * (first/last/display name -- only changed ones, cleared first/last as null, 422 `details.fields` per field; birth date, address, phone, contact e-mail, emergency contact) via
 * `PATCH /club-members/me` -- category, memberNumber, status stay board-only
 * (`members:write`). Only changed fields are sent; a cleared text field is
 * sent as "" (the backend turns it into NULL), a cleared contact e-mail and a
 * cleared birth date as null (the backend's e-mail/date schemas reject "").
 */
export default function ProfilTab({ clubId, onDirtyChange }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { membership, refetch, can } = useOwnMembership(clubId);

  const server = useMemo<Draft>(() => {
    if (!membership) return EMPTY_DRAFT;
    return {
      ...nameDraftFromMember(membership),
      birthDate: fromDateString(membership.birthDate),
      street: membership.street ?? '',
      postalCode: membership.postalCode ?? '',
      city: membership.city ?? '',
      phone: membership.phone ?? '',
      contactEmail: membership.contactEmail ?? '',
      emergencyContactName: membership.emergencyContactName ?? '',
      emergencyContactPhone: membership.emergencyContactPhone ?? '',
    };
  }, [membership]);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customDirty, setCustomDirty] = useState(false);
  const [childDirty, setChildDirty] = useState(false);
  const [serverNameErrors, setServerNameErrors] = useState<NameErrors>({});
  const inputs = useRef<Partial<Record<TextKey, TextInput | null>>>({});
  // "Next" on the keyboard moves through the name fields.
  const focusNext = useCallback((key: TextKey) => {
    const next = key === 'firstName' ? 'lastName' : key === 'lastName' ? 'displayName' : null;
    if (next) inputs.current[next]?.focus();
  }, []);

  // Fresh server values flow into fields the user has not touched since the last
  // sync; anything typed meanwhile (e.g. during the post-save refetch) is kept.
  const prevServer = useRef<Draft>(EMPTY_DRAFT);
  useEffect(() => {
    const prev = prevServer.current;
    prevServer.current = server;
    setDraft((cur) => {
      const next = { ...cur };
      for (const k of TEXT_KEYS) {
        if (cur[k].trim() === prev[k].trim()) next[k] = server[k];
      }
      const dayKey = (d: Date | null) => (d ? toDateString(d) : null);
      if (dayKey(cur.birthDate) === dayKey(prev.birthDate)) next.birthDate = server.birthDate;
      return next;
    });
  }, [server]);

  const toDateKey = (d: Date | null) => (d ? toDateString(d) : null);
  const changedTextKeys = TEXT_KEYS.filter((k) => !(NAME_FIELD_KEYS as readonly string[]).includes(k)).filter((k) => draft[k].trim() !== server[k].trim());
  const birthDateChanged = toDateKey(draft.birthDate) !== toDateKey(server.birthDate);
  const nameBody = namePatch(draft, server);
  const nameChanged = Object.keys(nameBody).length > 0;
  const dirty = !!membership && (changedTextKeys.length > 0 || birthDateChanged || nameChanged);

  const anyDirty = dirty || customDirty || childDirty;
  useEffect(() => {
    onDirtyChange?.(anyDirty);
  }, [anyDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const errors = validate(draft, t);
  const visibleErrors: FieldErrors = showErrors ? errors : {};
  const nameValidation = validateName(draft);
  const nameErrorText = (key: (typeof NAME_FIELD_KEYS)[number]): string | undefined => {
    const code = (showErrors ? nameValidation[key] : undefined) ?? serverNameErrors[key];
    return code ? t(`profil.error.name-${code}`) : undefined;
  };

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setServerNameErrors((prev) => (key in prev ? { ...prev, [key]: undefined } : prev));
    setSaved(false);
    setError(null);
  }, []);

  const handleDiscard = () => {
    Alert.alert(t('profil.discard.title'), t('profil.discard.message'), [
      { text: t('profil.discard.keep'), style: 'cancel' },
      {
        text: t('profil.discard.confirm'),
        style: 'destructive',
        onPress: () => {
          setDraft(server);
          setServerNameErrors({});
          setShowErrors(false);
          setError(null);
        },
      },
    ]);
  };

  const handleSave = async () => {
    setShowErrors(true);
    if (isSaving || Object.keys(errors).length > 0 || Object.keys(nameValidation).length > 0) return;
    setIsSaving(true);
    setServerNameErrors({});
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string | null> = { ...nameBody };
      for (const k of changedTextKeys) {
        const value = draft[k].trim();
        body[k] = k === 'contactEmail' && value === '' ? null : value;
      }
      if (birthDateChanged) body.birthDate = toDateKey(draft.birthDate);
      await apiFetch(`/club-members/me?clubId=${encodeURIComponent(clubId)}`, { method: 'PATCH', body });
      setSaved(true);
      setShowErrors(false);
      await refetch();
    } catch (err) {
      const nameFieldErrors = nameFieldErrorsFromApi(err);
      setServerNameErrors(nameFieldErrors);
      if (Object.keys(nameFieldErrors).length === 0) setError(apiErrorMessage(err, t));
    } finally {
      setIsSaving(false);
    }
  };

  // Spinner only for the very first load; a refetch after saving keeps the form.
  if (!membership) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  const textInput = (key: TextKey, label: string, extra: React.ComponentProps<typeof TextInput> = {}, fieldError?: string) => (
    <Field label={label}>
      <TextInput
        ref={(el) => {
          inputs.current[key] = el;
        }}
        blurOnSubmit={key !== 'displayName'}
        onSubmitEditing={() => focusNext(key)}
        className={`${inputClassName} ${fieldError ? 'border-destructive' : ''}`}
        placeholderTextColor={themeColors.mutedForeground}
        value={draft[key]}
        onChangeText={(v) => update(key, v)}
        accessibilityLabel={label}
        {...extra}
      />
      {fieldError ? <Text className="text-destructive text-xs mt-1">{fieldError}</Text> : null}
    </Field>
  );

  const minor = isMinorBirthDate(membership.birthDate);

  return (
    <View>
      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('member-photo.title')}</Text>
        <MemberPhotoEditor
          clubId={clubId}
          target="me"
          name={membership.name}
          photoUrl={membership.photoUrl}
          readOnly={minor}
          hint={minor ? t('member-photo.minor-hint') : t('member-photo.privacy-hint')}
          onChanged={() => void refetch()}
          onPhotoExpired={() => void refetch()}
        />
      </View>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('profil.section.name')}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('profil.name.hint')}</Text>
        {textInput(
          'firstName',
          t('profil.first-name'),
          { maxLength: 100, autoComplete: 'name-given', textContentType: 'givenName', autoCapitalize: 'words', returnKeyType: 'next' },
          nameErrorText('firstName'),
        )}
        {textInput(
          'lastName',
          t('profil.last-name'),
          { maxLength: 100, autoComplete: 'name-family', textContentType: 'familyName', autoCapitalize: 'words', returnKeyType: 'next' },
          nameErrorText('lastName'),
        )}
        {textInput(
          'displayName',
          t('profil.display-name'),
          { maxLength: 200, textContentType: 'nickname', autoCapitalize: 'words', returnKeyType: 'done' },
          nameErrorText('displayName'),
        )}
        <TouchableOpacity
          className="rounded-xl items-center justify-center border border-border dark:border-border-dark mt-1"
          style={{ minHeight: 44 }}
          onPress={() => navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel={t('profil.name.settings')}
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('profil.name.settings')}</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('profil.section.personal')}</Text>
        <Field label={t('profil.birth-date')}>
          <DateTimeField mode="date" value={draft.birthDate} onChange={(d) => update('birthDate', d)} clearable />
        </Field>
      </View>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('profil.section.address')}</Text>
        {textInput('street', t('profil.street'), { maxLength: 200, autoComplete: 'street-address', textContentType: 'streetAddressLine1' })}
        {textInput('postalCode', t('profil.postal-code'), { maxLength: 12, autoComplete: 'postal-code', textContentType: 'postalCode' }, visibleErrors.postalCode)}
        {textInput('city', t('profil.city'), { maxLength: 120, textContentType: 'addressCity' })}
      </View>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1">{t('profil.section.contact')}</Text>
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('profil.contact.hint')}</Text>
        {textInput('phone', t('profil.phone'), { keyboardType: 'phone-pad', maxLength: 50, textContentType: 'telephoneNumber' })}
        {textInput(
          'contactEmail',
          t('profil.contact-email'),
          { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, maxLength: 320, textContentType: 'emailAddress' },
          visibleErrors.contactEmail,
        )}
      </View>

      <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-3">{t('profil.section.emergency')}</Text>
        {textInput('emergencyContactName', t('profil.emergency-contact-name'), { maxLength: 200 })}
        {textInput('emergencyContactPhone', t('profil.emergency-contact-phone'), { keyboardType: 'phone-pad', maxLength: 50 })}
      </View>

      {error ? (
        <Text className="text-destructive text-sm mb-3" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {saved && !error && !dirty ? (
        <Text className="text-success dark:text-success-dark text-sm mb-3" accessibilityLiveRegion="polite">
          {t('profil.saved')}
        </Text>
      ) : null}
      {dirty && !error ? <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mb-3">{t('profil.unsaved')}</Text> : null}

      <TouchableOpacity
        className={`bg-primary dark:bg-primary-dark rounded-xl py-3 items-center justify-center ${isSaving || !dirty ? 'opacity-50' : ''}`}
        style={{ minHeight: 48 }}
        onPress={() => void handleSave()}
        disabled={isSaving || !dirty}
        accessibilityRole="button"
        accessibilityLabel={t('profil.save')}
        accessibilityState={{ disabled: isSaving || !dirty, busy: isSaving }}
      >
        {isSaving ? (
          <ActivityIndicator color={themeColors.primaryForeground} />
        ) : (
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('profil.save')}</Text>
        )}
      </TouchableOpacity>

      {dirty && !isSaving ? (
        <TouchableOpacity
          className="rounded-xl py-3 items-center justify-center mt-2"
          style={{ minHeight: 48 }}
          onPress={handleDiscard}
          accessibilityRole="button"
          accessibilityLabel={t('profil.discard')}
        >
          <Text className="text-destructive text-sm font-semibold">{t('profil.discard')}</Text>
        </TouchableOpacity>
      ) : null}

      <View className="mt-6">
        <MyDocumentsEntry />
        <AbsenceSection subject={{ kind: 'self', clubId }} />
        {membership ? <ConsentsSection subject={{ kind: 'self', clubId, clubMemberId: membership.id }} /> : null}
        <MemberCustomFields clubId={clubId} target="me" card onDirtyChange={setCustomDirty} manageHint={can('forms:write')} />
        <ChildrenCustomFields clubId={clubId} onDirtyChange={setChildDirty} />
        <ExitRequestSection clubId={clubId} />
      </View>
    </View>
  );
}
