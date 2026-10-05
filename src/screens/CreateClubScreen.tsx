import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, Check, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { ApiError } from '@/lib/api';
import { withScheme } from '@/lib/withScheme';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
  CLAIMED_ROLES,
  DOCUMENT_KINDS,
  LEGAL_FORMS,
  MAX_DOCUMENTS,
  MAX_DOCUMENT_BYTES,
  isEditableStatus,
  useClubRegistration,
  type ClaimedRole,
  type ClubRegistration,
  type DocumentKind,
  type LegalForm,
  type RegistrationInput,
} from '@/hooks/useClubRegistration';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateClub'>;
type Translate = (key: string, params?: Record<string, string | number>) => string;

// The backend allowlist also contains PDF, but no document picker module is
// installed in this app (no new dependency) -- proof is picked from the
// photo library, so only the image types are accepted here.
const ALLOWED_MIME = ['image/jpeg', 'image/png'];

const LABEL_CLASS = 'text-xs font-semibold uppercase mb-1.5 text-muted-foreground dark:text-muted-foreground-dark';
const INPUT_CLASS =
  'bg-muted dark:bg-muted-dark rounded-lg p-3 text-base text-foreground dark:text-foreground-dark border border-border dark:border-border-dark mb-4';

interface FormState {
  clubName: string;
  legalForm: LegalForm;
  registerCourt: string;
  registerNumber: string;
  street: string;
  postalCode: string;
  city: string;
  websiteUrl: string;
}

function initialForm(reg: ClubRegistration | null): FormState {
  return {
    clubName: reg?.clubName ?? '',
    legalForm: reg?.legalForm ?? 'e_v',
    registerCourt: reg?.registerCourt ?? '',
    registerNumber: reg?.registerNumber ?? '',
    street: reg?.street ?? '',
    postalCode: reg?.postalCode ?? '',
    city: reg?.city ?? '',
    websiteUrl: reg?.websiteUrl ?? '',
  };
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function errorText(err: unknown, t: Translate, context: 'create' | 'patch' | 'submit'): string {
  if (err instanceof ApiError) {
    if (context === 'create' && err.status === 409) return t('create-club.error.open-exists');
    if (context === 'patch' && err.status === 409) return t('create-club.error.not-editable');
    if (context === 'submit' && err.status === 409) return t('create-club.error.club-exists');
    if (context === 'submit' && err.status === 422) return t('create-club.error.no-document');
    return err.message;
  }
  return t('alert.general-error-description');
}

function uploadErrorText(status: number | undefined, message: string, t: Translate): string {
  if (status === 413) return t('create-club.docs.error.size');
  if (status === 415) return t('create-club.docs.error.type');
  if (status === 400) return t('create-club.docs.error.upload');
  return message || t('create-club.docs.error.upload');
}

// The picker's `mimeType` can be missing: derive it from the extension
// instead of assuming JPEG. Unknown extensions yield null (rejected).
function guessMime(name: string): string | null {
  const ext = name.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return null;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full ${active ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark border border-border dark:border-border-dark'}`}
    >
      <Text
        className={`text-xs font-semibold ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const themeColors = useThemeColors();
  return (
    <TouchableOpacity
      className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center ${busy || disabled ? 'opacity-70' : ''}`}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? (
        <ActivityIndicator color={themeColors.primaryForeground} />
      ) : (
        <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      className={`bg-muted dark:bg-muted-dark border border-border dark:border-border-dark rounded-lg py-3.5 items-center ${disabled ? 'opacity-70' : ''}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className="text-foreground dark:text-foreground-dark text-base font-semibold">{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2">
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{label}</Text>
      <Text className="text-sm text-foreground dark:text-foreground-dark">{value}</Text>
    </View>
  );
}

interface UploadItem {
  localId: number;
  name: string;
  kind: DocumentKind;
  status: 'uploading' | 'error';
  error?: string;
}

interface WizardProps {
  registration: ClubRegistration | null;
  saveDraft: ReturnType<typeof useClubRegistration>['saveDraft'];
  uploadDocument: ReturnType<typeof useClubRegistration>['uploadDocument'];
  removeDocument: ReturnType<typeof useClubRegistration>['removeDocument'];
  submit: ReturnType<typeof useClubRegistration>['submit'];
  onDone: () => void;
  /** Message that must survive this wizard unmounting (e.g. after a 409 reload). */
  onNotice: (message: string) => void;
}

function Wizard({ registration, saveDraft, uploadDocument, removeDocument, submit, onDone, onNotice }: WizardProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(() => initialForm(registration));
  const [role, setRole] = useState<ClaimedRole>(registration?.claimedRole ?? 'vorsitz');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DocumentKind>('registerauszug');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadSeq, setUploadSeq] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const documents = registration?.documents ?? [];
  const isEv = form.legalForm === 'e_v';
  const set = (field: keyof FormState) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const dataValid =
    form.clubName.trim() !== '' &&
    form.street.trim() !== '' &&
    form.postalCode.trim() !== '' &&
    form.city.trim() !== '' &&
    (!isEv || (form.registerCourt.trim() !== '' && form.registerNumber.trim() !== ''));

  const buildInput = (): RegistrationInput => ({
    clubName: form.clubName.trim(),
    legalForm: form.legalForm,
    registerCourt: isEv ? form.registerCourt.trim() : null,
    registerNumber: isEv ? form.registerNumber.trim() : null,
    street: form.street.trim(),
    postalCode: form.postalCode.trim(),
    city: form.city.trim(),
    websiteUrl: form.websiteUrl.trim() ? withScheme(form.websiteUrl.trim()) : null,
    claimedRole: role,
  });

  // 409s make the hook reload the registration, which may swap this wizard
  // for the status view -- keep the message in the parent too.
  const handleSaveError = (err: unknown) => {
    const message = errorText(err, t, registration ? 'patch' : 'create');
    setError(message);
    if (err instanceof ApiError && err.status === 409) onNotice(message);
  };

  const handleSaveData = async () => {
    if (!dataValid || busy) return;
    setError(null);
    setBusy(true);
    try {
      await saveDraft(buildInput());
      setStep(2);
    } catch (err) {
      handleSaveError(err);
    } finally {
      setBusy(false);
    }
  };

  const handlePickDocument = async () => {
    if (!registration) return;
    setError(null);
    if (documents.length + uploads.filter((u) => u.status === 'uploading').length >= MAX_DOCUMENTS) {
      setError(t('create-club.docs.error.max', { max: MAX_DOCUMENTS }));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('create-club.docs.error.permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'nachweis';
    const type = asset.mimeType ?? guessMime(name) ?? guessMime(asset.uri);
    if (!type || !ALLOWED_MIME.includes(type)) {
      setError(t('create-club.docs.error.type'));
      return;
    }
    if (asset.fileSize !== undefined && asset.fileSize > MAX_DOCUMENT_BYTES) {
      setError(t('create-club.docs.error.size'));
      return;
    }

    const localId = uploadSeq + 1;
    setUploadSeq(localId);
    setUploads((prev) => [...prev, { localId, name, kind, status: 'uploading' }]);
    const outcome = await uploadDocument({ uri: asset.uri, name, type }, kind);
    setUploads((prev) =>
      outcome.error
        ? prev.map((u) =>
            u.localId === localId
              ? { ...u, status: 'error', error: uploadErrorText(outcome.status, outcome.error ?? '', t) }
              : u,
          )
        : prev.filter((u) => u.localId !== localId),
    );
  };

  const handleRemove = async (docId: string) => {
    setRemovingId(docId);
    setError(null);
    try {
      await removeDocument(docId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('alert.general-error-description'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!confirmed || busy) return;
    setError(null);
    setBusy(true);
    try {
      // Role may have changed on the summary step -- persist before submit.
      try {
        await saveDraft(buildInput());
      } catch (err) {
        handleSaveError(err);
        return;
      }
      try {
        await submit();
        onDone();
      } catch (err) {
        setError(errorText(err, t, 'submit'));
      }
    } finally {
      setBusy(false);
    }
  };

  const uploading = uploads.some((u) => u.status === 'uploading');

  return (
    <KeyboardAwareScreen
      className="bg-muted dark:bg-muted-dark"
      contentContainerStyle={{ flexGrow: 1, padding: 25, paddingBottom: 60 }}
    >
      <Text className="text-3xl font-extrabold text-center mb-1 text-foreground dark:text-foreground-dark">
        {t('create-club.title')}
      </Text>
      <Text className="text-sm text-center mb-6 text-muted-foreground dark:text-muted-foreground-dark">
        {t('create-club.step', { step, total: 3 })} · {t(`create-club.step${step}.title`)}
      </Text>

      {registration?.status === 'needs_info' && registration.reviewNote ? (
        <View className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4">
          <Text className="text-xs font-semibold uppercase mb-1 text-muted-foreground dark:text-muted-foreground-dark">
            {t('create-club.status.review-note')}
          </Text>
          <Text className="text-sm text-foreground dark:text-foreground-dark">{registration.reviewNote}</Text>
        </View>
      ) : null}

      <View className="bg-card dark:bg-card-dark p-5 rounded-2xl">
        {step === 1 && (
          <>
            <Text className={LABEL_CLASS}>{t('create-club.name.label')}</Text>
            <TextInput
              className={INPUT_CLASS}
              placeholder={t('create-club.name.placeholder')}
              placeholderTextColor={themeColors.mutedForeground}
              value={form.clubName}
              onChangeText={set('clubName')}
            />

            <Text className={LABEL_CLASS}>{t('create-club.legal-form.label')}</Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {LEGAL_FORMS.map((value) => (
                <Chip
                  key={value}
                  label={t(`create-club.legal-form.${value}`)}
                  active={form.legalForm === value}
                  onPress={() => setForm((prev) => ({ ...prev, legalForm: value }))}
                />
              ))}
            </View>

            {isEv ? (
              <>
                <Text className={LABEL_CLASS}>{t('create-club.register-court.label')}</Text>
                <TextInput
                  className={INPUT_CLASS}
                  placeholder={t('create-club.register-court.placeholder')}
                  placeholderTextColor={themeColors.mutedForeground}
                  value={form.registerCourt}
                  onChangeText={set('registerCourt')}
                />
                <Text className={LABEL_CLASS}>{t('create-club.register-number.label')}</Text>
                <TextInput
                  className={INPUT_CLASS}
                  placeholder={t('create-club.register-number.placeholder')}
                  placeholderTextColor={themeColors.mutedForeground}
                  autoCapitalize="characters"
                  value={form.registerNumber}
                  onChangeText={set('registerNumber')}
                />
              </>
            ) : null}

            <Text className={LABEL_CLASS}>{t('create-club.street.label')}</Text>
            <TextInput className={INPUT_CLASS} value={form.street} onChangeText={set('street')} />

            <View className="flex-row" style={{ gap: 10 }}>
              <View style={{ width: 110 }}>
                <Text className={LABEL_CLASS}>{t('create-club.postal-code.label')}</Text>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="number-pad"
                  value={form.postalCode}
                  onChangeText={set('postalCode')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text className={LABEL_CLASS}>{t('create-club.city.label')}</Text>
                <TextInput className={INPUT_CLASS} value={form.city} onChangeText={set('city')} />
              </View>
            </View>

            <Text className={LABEL_CLASS}>{t('create-club.website.label')}</Text>
            <TextInput
              className={INPUT_CLASS}
              placeholder="https://"
              placeholderTextColor={themeColors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={form.websiteUrl}
              onChangeText={set('websiteUrl')}
            />

            <Text className="text-xs mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.slug-hint')}
            </Text>

            {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}
            <PrimaryButton label={t('create-club.next')} onPress={() => void handleSaveData()} busy={busy} disabled={!dataValid} />
          </>
        )}

        {step === 2 && (
          <>
            <Text className="text-sm mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.docs.description', { max: MAX_DOCUMENTS, size: formatSize(MAX_DOCUMENT_BYTES) })}
            </Text>

            {documents.map((doc) => (
              <View
                key={doc.id}
                className="flex-row items-center bg-muted dark:bg-muted-dark rounded-lg p-3 mb-2"
                style={{ gap: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark" numberOfLines={1}>
                    {doc.filename}
                  </Text>
                  <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {t(`create-club.doc-kind.${doc.kind}`)} · {formatSize(doc.sizeBytes)}
                  </Text>
                </View>
                {removingId === doc.id ? (
                  <ActivityIndicator color={themeColors.primary} />
                ) : (
                  <TouchableOpacity
                    onPress={() => void handleRemove(doc.id)}
                    accessibilityLabel={t('create-club.docs.remove')}
                    hitSlop={8}
                  >
                    <Trash2 size={18} color={themeColors.destructive} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {uploads.map((item) => (
              <View key={item.localId} className="flex-row items-center bg-muted dark:bg-muted-dark rounded-lg p-3 mb-2" style={{ gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text
                    className={`text-xs ${item.status === 'error' ? 'text-destructive' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
                  >
                    {item.status === 'error' ? (item.error ?? t('create-club.docs.error.upload')) : t('create-club.docs.uploading')}
                  </Text>
                </View>
                {item.status === 'uploading' ? (
                  <ActivityIndicator color={themeColors.primary} />
                ) : (
                  <TouchableOpacity
                    onPress={() => setUploads((prev) => prev.filter((u) => u.localId !== item.localId))}
                    accessibilityLabel={t('create-club.docs.dismiss')}
                    hitSlop={8}
                  >
                    <Trash2 size={18} color={themeColors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <Text className={`${LABEL_CLASS} mt-2`}>{t('create-club.docs.kind.label')}</Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {DOCUMENT_KINDS.map((value) => (
                <Chip key={value} label={t(`create-club.doc-kind.${value}`)} active={kind === value} onPress={() => setKind(value)} />
              ))}
            </View>

            <TouchableOpacity
              className="flex-row items-center justify-center border border-border dark:border-border-dark rounded-lg py-3 mb-2"
              style={{ gap: 8 }}
              onPress={() => void handlePickDocument()}
            >
              <Camera size={18} color={themeColors.primary} />
              <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('create-club.docs.pick')}</Text>
            </TouchableOpacity>
            <Text className="text-xs mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.docs.pdf-hint')}
            </Text>

            {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}
            <View style={{ gap: 10 }}>
              <PrimaryButton
                label={t('create-club.next')}
                onPress={() => {
                  setError(null);
                  setStep(3);
                }}
                disabled={documents.length === 0 || uploading}
              />
              <SecondaryButton label={t('create-club.back')} onPress={() => setStep(1)} disabled={uploading} />
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <SummaryRow label={t('create-club.name.label')} value={form.clubName.trim()} />
            <SummaryRow label={t('create-club.legal-form.label')} value={t(`create-club.legal-form.${form.legalForm}`)} />
            {isEv ? (
              <SummaryRow
                label={t('create-club.summary.register')}
                value={`${form.registerCourt.trim()} · ${form.registerNumber.trim()}`}
              />
            ) : null}
            <SummaryRow
              label={t('create-club.summary.address')}
              value={`${form.street.trim()}, ${form.postalCode.trim()} ${form.city.trim()}`}
            />
            {form.websiteUrl.trim() ? <SummaryRow label={t('create-club.website.label')} value={form.websiteUrl.trim()} /> : null}
            <SummaryRow
              label={t('create-club.summary.documents')}
              value={documents.map((d) => `${t(`create-club.doc-kind.${d.kind}`)} (${d.filename})`).join('\n')}
            />

            <Text className={`${LABEL_CLASS} mt-2`}>{t('create-club.role.label')}</Text>
            <View className="flex-row flex-wrap mb-2" style={{ gap: 8 }}>
              {CLAIMED_ROLES.map((value) => (
                <Chip key={value} label={t(`verein.role.${value}`)} active={role === value} onPress={() => setRole(value)} />
              ))}
            </View>
            <Text className="text-xs mb-4 text-muted-foreground dark:text-muted-foreground-dark">{t('create-club.role.hint')}</Text>

            <TouchableOpacity
              className="flex-row items-start mb-4"
              style={{ gap: 10 }}
              onPress={() => setConfirmed((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
            >
              <View
                className={`w-6 h-6 rounded border items-center justify-center ${confirmed ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'}`}
              >
                {confirmed ? <Check size={16} color={themeColors.primaryForeground} /> : null}
              </View>
              <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">{t('create-club.confirm')}</Text>
            </TouchableOpacity>

            <Text className="text-xs mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.slug-hint')}
            </Text>

            {error ? <Text className="text-destructive text-sm mb-3 text-center">{error}</Text> : null}
            <View style={{ gap: 10 }}>
              <PrimaryButton label={t('create-club.submit')} onPress={() => void handleSubmit()} busy={busy} disabled={!confirmed} />
              <SecondaryButton label={t('create-club.back')} onPress={() => setStep(2)} disabled={busy} />
            </View>
          </>
        )}
      </View>
    </KeyboardAwareScreen>
  );
}

function StatusView({
  registration,
  onEdit,
  onRestart,
  onOpenClub,
  onBack,
  notice,
}: {
  registration: ClubRegistration;
  notice: string | null;
  onEdit: () => void;
  onRestart: () => void;
  onOpenClub: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const { status } = registration;

  return (
    <KeyboardAwareScreen
      className="bg-muted dark:bg-muted-dark"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }}
    >
      <View className="bg-card dark:bg-card-dark p-6 rounded-2xl">
        {notice ? <Text className="text-destructive text-sm mb-3 text-center">{notice}</Text> : null}
        <Text className="text-xs font-semibold uppercase text-center mb-1 text-muted-foreground dark:text-muted-foreground-dark">
          {registration.clubName}
        </Text>
        <Text className="text-xl font-extrabold text-center mb-2 text-foreground dark:text-foreground-dark">
          {t(`create-club.status.${status}.title`)}
        </Text>
        <Text className="text-sm text-center mb-4 text-muted-foreground dark:text-muted-foreground-dark">
          {t(`create-club.status.${status}.body`)}
        </Text>

        {(status === 'needs_info' || status === 'rejected') && registration.reviewNote ? (
          <View className="bg-muted dark:bg-muted-dark rounded-lg p-3 mb-4">
            <Text className="text-xs font-semibold uppercase mb-1 text-muted-foreground dark:text-muted-foreground-dark">
              {t(status === 'rejected' ? 'create-club.status.reject-reason' : 'create-club.status.review-note')}
            </Text>
            <Text className="text-sm text-foreground dark:text-foreground-dark">{registration.reviewNote}</Text>
          </View>
        ) : null}

        {status === 'approved' && registration.clubSlug ? (
          <View className="bg-muted dark:bg-muted-dark rounded-lg p-3 mb-4">
            <Text className="text-xs font-semibold uppercase mb-1 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.status.slug')}
            </Text>
            <Text className="text-base font-bold text-foreground dark:text-foreground-dark">{registration.clubSlug}</Text>
            <Text className="text-xs mt-1 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.status.slug-hint')}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          {status === 'needs_info' ? <PrimaryButton label={t('create-club.status.edit')} onPress={onEdit} /> : null}
          {status === 'rejected' ? <PrimaryButton label={t('create-club.status.restart')} onPress={onRestart} /> : null}
          {status === 'approved' ? (
            <PrimaryButton label={t('create-club.status.open-club')} onPress={onOpenClub} />
          ) : null}
          <SecondaryButton label={t('create-club.status.back')} onPress={onBack} />
        </View>
      </View>
    </KeyboardAwareScreen>
  );
}

/**
 * Wave 6 club registration (M1/M2): 3-step wizard (club data -> proof
 * upload -> summary + own board role + confirmation) that keeps a
 * server-side draft, plus a status view for submitted registrations
 * (pending / needs_info / rejected / approved). The slug is never asked --
 * the backend generates it and assigns it on approval. All data/race
 * handling lives in `useClubRegistration`.
 */
export default function CreateClubScreen({ navigation }: Props) {
  const themeColors = useThemeColors();
  const { t } = useLanguage();
  const { registration, loading, error, refetch, saveDraft, uploadDocument, removeDocument, submit } = useClubRegistration();
  // True while the user chose "edit" (needs_info) or "start a new one"
  // (rejected) from the status view.
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !registration) {
    return (
      <View className="flex-1 items-center justify-center bg-muted dark:bg-muted-dark">
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  if (error && !registration) {
    return (
      <View className="flex-1 items-center justify-center bg-muted dark:bg-muted-dark px-8">
        <Text className="text-sm text-center mb-4 text-muted-foreground dark:text-muted-foreground-dark">
          {t('create-club.error.load')}
        </Text>
        <TouchableOpacity className="bg-primary dark:bg-primary-dark rounded-lg py-3 px-6" onPress={() => void refetch()}>
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">
            {t('verein.applications.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showWizard = !registration || editing || registration.status === 'draft';
  if (showWizard) {
    return (
      <Wizard
        // A rejected registration is not editable: the wizard then starts
        // blank and saveDraft creates a fresh draft via POST.
        registration={registration && isEditableStatus(registration.status) ? registration : null}
        saveDraft={saveDraft}
        uploadDocument={uploadDocument}
        removeDocument={removeDocument}
        submit={submit}
        onDone={() => {
          setNotice(null);
          setEditing(false);
        }}
        onNotice={(message) => {
          setNotice(message);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <StatusView
      registration={registration}
      notice={notice}
      onEdit={() => {
        setNotice(null);
        setEditing(true);
      }}
      onRestart={() => {
        setNotice(null);
        setEditing(true);
      }}
      // VereinScreen reloads its clubs on focus, so just return there.
      onOpenClub={() => navigation.navigate('Verein')}
      onBack={() => navigation.goBack()}
    />
  );
}
