import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import { apiFetch, ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { useOwnMembership } from '@/hooks/useOwnMembership';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import { Field, inputClassName } from '@/components/ui/FormSheet';
import ExitRequestSection from './ExitRequestSection';

interface Props {
  clubId: string;
  /** Reports whether there are unsaved inputs, so the parent can guard leaving the tab. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface Draft {
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
const TEXT_KEYS: readonly TextKey[] = ['street', 'postalCode', 'city', 'phone', 'contactEmail', 'emergencyContactName', 'emergencyContactPhone'];

const EMPTY_DRAFT: Draft = {
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
 * (birth date, address, phone, contact e-mail, emergency contact) via
 * `PATCH /club-members/me` -- category, memberNumber, status stay board-only
 * (`members:write`). Only changed fields are sent; a cleared text field is
 * sent as "" (the backend turns it into NULL), a cleared contact e-mail and a
 * cleared birth date as null (the backend's e-mail/date schemas reject "").
 */
export default function ProfilTab({ clubId, onDirtyChange }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { membership, refetch } = useOwnMembership(clubId);

  const server = useMemo<Draft>(() => {
    if (!membership) return EMPTY_DRAFT;
    return {
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
  const changedTextKeys = TEXT_KEYS.filter((k) => draft[k].trim() !== server[k].trim());
  const birthDateChanged = toDateKey(draft.birthDate) !== toDateKey(server.birthDate);
  const dirty = !!membership && (changedTextKeys.length > 0 || birthDateChanged);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const errors = validate(draft, t);
  const visibleErrors: FieldErrors = showErrors ? errors : {};

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
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
          setShowErrors(false);
          setError(null);
        },
      },
    ]);
  };

  const handleSave = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string | null> = {};
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
      setError(apiErrorMessage(err, t));
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

  return (
    <View>
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
        <ExitRequestSection clubId={clubId} />
      </View>
    </View>
  );
}
