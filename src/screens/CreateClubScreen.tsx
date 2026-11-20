import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, Check, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import Button from '@/components/ui/Button';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { withScheme } from '@/lib/withScheme';
import { goToTab } from '@/navigation/navigationRef';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
  CLAIMED_ROLES,
  normalizeClaimedRole,
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
import Banner from '@/components/ui/Banner';
import ErrorState from '@/components/ui/ErrorState';
import FlowHeader from '@/components/ui/FlowHeader';
import PressScale from '@/components/ui/PressScale';
import Surface from '@/components/ui/Surface';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateClub'>;
type Translate = (key: string, params?: Record<string, string | number>) => string;

// The backend allowlist also contains PDF, but no document picker module is
// installed in this app (no new dependency) -- proof is picked from the
// photo library, so only the image types are accepted here.
const ALLOWED_MIME = ['image/jpeg', 'image/png'];

const LABEL_CLASS = 'text-[13px] leading-[18px] font-medium mb-1.5 text-muted-foreground dark:text-muted-foreground-dark';
const INPUT_CLASS =
  'bg-card dark:bg-card-dark rounded-control px-3 py-3 min-h-[48px] text-[17px] text-foreground dark:text-foreground-dark border border-border-control dark:border-border-control-dark mb-4';

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
    return apiErrorMessage(err, t);
  }
  return t('alert.general-error-description');
}

function uploadErrorText(status: number | undefined, t: Translate): string {
  if (status === 413) return t('create-club.docs.error.size');
  if (status === 415) return t('create-club.docs.error.type');
  if (status === 400) return t('create-club.docs.error.upload');
  return t('create-club.docs.error.upload');
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
  const themeColors = useThemeColors();
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      onPress={onPress}
      scale={0.98}
      className={`flex-row items-center rounded-full px-3.5 ${active ? 'bg-primary-soft dark:bg-primary-soft-dark' : 'bg-card dark:bg-card-dark border border-border-control dark:border-border-control-dark'}`}
      style={{ minHeight: 44, gap: 6 }}
    >
      {active ? <Check size={16} strokeWidth={2} color={themeColors.primarySoftForeground} /> : null}
      <Text
        className={`text-[15px] leading-5 font-medium ${active ? 'text-primary-soft-foreground dark:text-primary-soft-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}
      >
        {label}
      </Text>
    </PressScale>
  );
}

function PrimaryButton({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return <Button label={label} onPress={onPress} loading={busy} disabled={disabled} />;
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Button variant="secondary" label={label} onPress={onPress} disabled={disabled} />;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="px-4 py-3 border-b border-divider dark:border-divider-dark">
      <Text className="text-[13px] leading-[18px] text-muted-foreground dark:text-muted-foreground-dark">{label}</Text>
      <Text className="text-[15px] leading-[22px] text-foreground dark:text-foreground-dark">{value}</Text>
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
  onBack: () => void;
  /** Message that must survive this wizard unmounting (e.g. after a 409 reload). */
  onNotice: (message: string) => void;
}

function Wizard({ registration, saveDraft, uploadDocument, removeDocument, submit, onDone, onBack, onNotice }: WizardProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(() => initialForm(registration));
  const [role, setRole] = useState<ClaimedRole>(normalizeClaimedRole(registration?.claimedRole));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DocumentKind>('registerauszug');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadSeq, setUploadSeq] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Last state the server has (step 1 is saved with "Weiter"): anything different is an unsaved draft -> ask before leaving.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ form: initialForm(registration), role: normalizeClaimedRole(registration?.claimedRole) }));
  useUnsavedChangesGuard(JSON.stringify({ form, role }) !== savedSnapshot);

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
      setSavedSnapshot(JSON.stringify({ form, role }));
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
              ? { ...u, status: 'error', error: uploadErrorText(outcome.status, t) }
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
      setError(apiErrorMessage(err, t));
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
        setSavedSnapshot(JSON.stringify({ form, role }));
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
      className="bg-background dark:bg-background-dark"
      contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 64 }}
    >
      <FlowHeader
        title={t('create-club.title')}
        eyebrow={`${t('create-club.step', { step, total: 3 })} · ${t(`create-club.step${step}.title`)}`}
        onBack={onBack}
      >
        <View className="flex-row mt-3" style={{ gap: 6 }} accessible accessibilityRole="progressbar" accessibilityLabel={t('create-club.step', { step, total: 3 })}>
          {[1, 2, 3].map((n) => (
            <View key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-primary dark:bg-primary-dark' : 'bg-border dark:bg-border-dark'}`} />
          ))}
        </View>
      </FlowHeader>

      {registration?.status === 'needs_info' && registration.reviewNote ? (
        <View className="px-4 mb-4">
          <Banner tone="warning" title={t('create-club.status.review-note')} body={registration.reviewNote} />
        </View>
      ) : null}

      <View className="px-4">
        {step === 1 && (
          <>
            <Text className={LABEL_CLASS}>{t('create-club.name.label')} *</Text>
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
                <Text className={LABEL_CLASS}>{t('create-club.register-court.label')} *</Text>
                <TextInput
                  className={INPUT_CLASS}
                  placeholder={t('create-club.register-court.placeholder')}
                  placeholderTextColor={themeColors.mutedForeground}
                  value={form.registerCourt}
                  onChangeText={set('registerCourt')}
                />
                <Text className={LABEL_CLASS}>{t('create-club.register-number.label')} *</Text>
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

            <Text className={LABEL_CLASS}>{t('create-club.street.label')} *</Text>
            <TextInput className={INPUT_CLASS} value={form.street} onChangeText={set('street')} autoComplete="street-address" textContentType="streetAddressLine1" />

            <View className="flex-row" style={{ gap: 10 }}>
              <View style={{ width: 110 }}>
                <Text className={LABEL_CLASS}>{t('create-club.postal-code.label')} *</Text>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="number-pad"
                  autoComplete="postal-code"
                  value={form.postalCode}
                  onChangeText={set('postalCode')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text className={LABEL_CLASS}>{t('create-club.city.label')} *</Text>
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

            <Text className="text-[13px] leading-[18px] mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.slug-hint')}
            </Text>

            {error ? (
              <View className="mb-3">
                <Banner tone="danger" body={error} />
              </View>
            ) : null}
            {!dataValid ? <Text className="text-[13px] leading-[18px] mb-2 text-muted-foreground dark:text-muted-foreground-dark">{t('create-club.required-hint')}</Text> : null}
            <PrimaryButton label={t('create-club.next')} onPress={() => void handleSaveData()} busy={busy} disabled={!dataValid} />
          </>
        )}

        {step === 2 && (
          <>
            <Text className="text-sm mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.docs.description', { max: MAX_DOCUMENTS, size: formatSize(MAX_DOCUMENT_BYTES) })}
            </Text>

            {documents.map((doc) => (
              <Surface
                key={doc.id}
                className="flex-row items-center p-3 mb-2"
                style={{ gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark" numberOfLines={1}>
                    {doc.filename}
                  </Text>
                  <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {t(`create-club.doc-kind.${doc.kind}`)} · {formatSize(doc.sizeBytes)}
                  </Text>
                </View>
                {removingId === doc.id ? (
                  <ActivityIndicator color={themeColors.primaryText} />
                ) : (
                  <PressScale accessibilityRole="button" onPress={() => void handleRemove(doc.id)} accessibilityLabel={t('create-club.docs.remove')} className="items-center justify-center" style={{ width: 44, height: 44 }}>
                    <Trash2 size={20} strokeWidth={1.75} color={themeColors.destructive} />
                  </PressScale>
                )}
              </Surface>
            ))}

            {uploads.map((item) => (
              <Surface key={item.localId} className="flex-row items-center p-3 mb-2" style={{ gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text
                    className={`text-xs ${item.status === 'error' ? 'text-destructive dark:text-destructive-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
                  >
                    {item.status === 'error' ? (item.error ?? t('create-club.docs.error.upload')) : t('create-club.docs.uploading')}
                  </Text>
                </View>
                {item.status === 'uploading' ? (
                  <ActivityIndicator color={themeColors.primaryText} />
                ) : (
                  <PressScale accessibilityRole="button" onPress={() => setUploads((prev) => prev.filter((u) => u.localId !== item.localId))} accessibilityLabel={t('create-club.docs.dismiss')} className="items-center justify-center" style={{ width: 44, height: 44 }}>
                    <Trash2 size={20} strokeWidth={1.75} color={themeColors.mutedForeground} />
                  </PressScale>
                )}
              </Surface>
            ))}

            <Text className={`${LABEL_CLASS} mt-2`}>{t('create-club.docs.kind.label')}</Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {DOCUMENT_KINDS.map((value) => (
                <Chip key={value} label={t(`create-club.doc-kind.${value}`)} active={kind === value} onPress={() => setKind(value)} />
              ))}
            </View>

            <View className="mb-2">
              <Button block variant="secondary" icon={Camera} label={t('create-club.docs.pick')} onPress={() => void handlePickDocument()} />
            </View>
            <Text className="text-[13px] leading-[18px] mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.docs.pdf-hint')}
            </Text>

            {error ? (
              <View className="mb-3">
                <Banner tone="danger" body={error} />
              </View>
            ) : null}
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
            <Surface className="overflow-hidden mb-5" style={{ marginBottom: 20 }}>
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
            </Surface>

            <Text className={LABEL_CLASS}>{t('create-club.role.label')}</Text>
            <View className="flex-row flex-wrap mb-2" style={{ gap: 8 }}>
              {CLAIMED_ROLES.map((value) => (
                <Chip key={value} label={t(`verein.role.${value}`)} active={role === value} onPress={() => setRole(value)} />
              ))}
            </View>
            <Text className="text-[13px] leading-[18px] mb-4 text-muted-foreground dark:text-muted-foreground-dark">{t('create-club.role.hint')}</Text>

            <TouchableOpacity
              className="flex-row items-start mb-4"
              style={{ gap: 10, minHeight: 44 }}
              onPress={() => setConfirmed((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
            >
              <View
                className={`w-6 h-6 rounded-md border items-center justify-center ${confirmed ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'border-border-control dark:border-border-control-dark'}`}
              >
                {confirmed ? <Check size={16} color={themeColors.primaryForeground} /> : null}
              </View>
              <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">{t('create-club.confirm')}</Text>
            </TouchableOpacity>

            <Text className="text-[13px] leading-[18px] mb-4 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.slug-hint')}
            </Text>

            {error ? (
              <View className="mb-3">
                <Banner tone="danger" body={error} />
              </View>
            ) : null}
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
      className="bg-background dark:bg-background-dark"
      contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 40 }}
    >
      <FlowHeader title={t(`create-club.status.${status}.title`)} eyebrow={registration.clubName} description={t(`create-club.status.${status}.body`)} onBack={onBack} />
      <View className="px-4">
        {notice ? (
          <View className="mb-4">
            <Banner tone="danger" body={notice} />
          </View>
        ) : null}

        {(status === 'needs_info' || status === 'rejected') && registration.reviewNote ? (
          <Surface className="p-4 mb-4">
            <Text className="text-[13px] font-medium mb-1 text-muted-foreground dark:text-muted-foreground-dark">
              {t(status === 'rejected' ? 'create-club.status.reject-reason' : 'create-club.status.review-note')}
            </Text>
            <Text className="text-sm text-foreground dark:text-foreground-dark">{registration.reviewNote}</Text>
          </Surface>
        ) : null}

        {status === 'approved' && registration.clubSlug ? (
          <Surface className="p-4 mb-4">
            <Text className="text-[13px] font-medium mb-1 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.status.slug')}
            </Text>
            <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">{registration.clubSlug}</Text>
            <Text className="text-xs mt-1 text-muted-foreground dark:text-muted-foreground-dark">
              {t('create-club.status.slug-hint')}
            </Text>
          </Surface>
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
  const { registration, loading, error, refetch, saveDraft, uploadDocument, removeDocument, submit } = useClubRegistration();
  // True while the user chose "edit" (needs_info) or "start a new one"
  // (rejected) from the status view.
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !registration) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={themeColors.primaryText} />
      </View>
    );
  }

  if (error && !registration) {
    return (
      <View className="flex-1 justify-center bg-background dark:bg-background-dark px-4">
        <ErrorState fallbackKey="create-club.error.load" onRetry={() => void refetch()} />
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
        onBack={() => navigation.goBack()}
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
      onOpenClub={() => goToTab('Verein')}
      onBack={() => navigation.goBack()}
    />
  );
}
