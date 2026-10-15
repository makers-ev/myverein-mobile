import React, { Fragment, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ChevronDown, FileText, Info, ShieldCheck, Trash2 } from 'lucide-react-native';

import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import {
  type Answers,
  checkFieldFile,
  type FieldErrorCode,
  fieldErrorKey,
  type FormField,
  type FormFile,
  FILE_FIELD_MAX_BYTES,
  formatBytes,
  formErrorKey,
  privacyNoticeIndex,
  visibleFields,
} from '@/lib/formSchema';
import { discardPickerFile, normalizeImageMime } from '@/lib/media';
import { useThemeColors } from '@/theme/colors';

/** A photo the person picked (camera or library); `type` is a normalised image MIME type. */
export interface PickedAsset {
  uri: string;
  name: string;
  type: string;
  fileSize?: number | null;
}

export interface FormRendererHandle {
  /** Moves focus to the text control of the field `key` (no-op for fields without a text input). */
  focusField: (key: string) => void;
}

export interface FormRendererProps {
  fields: FormField[];
  /** Privacy notice of the form version; shown prominently right above the first consent. */
  privacyNotice?: string | null;
  answers: Answers;
  onChange: (key: string, value: unknown) => void;
  /** Field errors by key (client validation or the server's `422 details.fields`). */
  errors?: Record<string, FieldErrorCode>;
  /** Uploaded files of the submission (all fields). */
  files?: FormFile[];
  disabled?: boolean;
  /**
   * Uploads a picked photo; reports progress; stops when `signal` aborts (cancel button, unmount); rejects with the
   * request error. Without it, file and image fields are not offered.
   */
  onUploadFile?: (fieldKey: string, asset: PickedAsset, onProgress: (percent: number | null) => void, signal: AbortSignal) => Promise<void>;
  onRemoveFile?: (file: FormFile) => Promise<void>;
  /** A signed preview URL stopped working (expired): the owner reloads the submission to get fresh ones. */
  onFilesExpired?: () => void;
  /** Receives the imperative handle (focus a field after a validation error). */
  handleRef?: React.Ref<FormRendererHandle>;
}

const INLINE_OPTION_LIMIT = 6;

const inputBase =
  'bg-muted dark:bg-muted-dark rounded-lg px-3 py-3 text-base text-foreground dark:text-foreground-dark border';
const inputClass = (error: boolean) =>
  `${inputBase} ${error ? 'border-destructive' : 'border-border dark:border-border-dark'}`;

/** Label, help text, the control and the error line of one field. */
function FieldShell({
  field,
  error,
  extraError,
  labelledByControl = false,
  children,
}: {
  field: FormField;
  error?: FieldErrorCode;
  /** Error text outside the validation codes (upload failures). */
  extraError?: string | null;
  /** The control carries label and hint itself: hide the visible texts from screen readers so they are not read twice. */
  labelledByControl?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const errorText = extraError ?? (error ? t(fieldErrorKey(error)) : null);
  return (
    <View>
      {/* Plain text on purpose: texts come from the club's form definition and are never interpreted as markup. */}
      <Text
        className="text-sm font-semibold text-foreground dark:text-foreground-dark"
        accessibilityLabel={field.required ? `${field.label}, ${t('forms.required')}` : field.label}
        {...(labelledByControl ? { importantForAccessibility: 'no' as const, accessibilityElementsHidden: true } : {})}
      >
        {field.label}
        {field.required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      {field.helpText ? (
        <Text
          className="text-xs text-muted-foreground dark:text-muted-foreground-dark mt-0.5"
          {...(labelledByControl ? { importantForAccessibility: 'no' as const, accessibilityElementsHidden: true } : {})}
        >
          {field.helpText}
        </Text>
      ) : null}
      <View className="mt-1.5">{children}</View>
      {errorText ? (
        <Text className="text-destructive text-xs mt-1" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}

/** The accessibility label of a control: the field label plus "required" so a screen reader announces both. */
function useA11y(field: FormField) {
  const { t } = useLanguage();
  return {
    accessibilityLabel: field.required ? `${field.label}, ${t('forms.required')}` : field.label,
    accessibilityHint: field.helpText || undefined,
  };
}

/**
 * Number input that keeps what is typed: an unfinished entry (`-`, `1,`) is not reported as "answer removed", so the
 * autosave never deletes an answer in the middle of typing. Accepts a decimal comma.
 */
function NumberInput({
  field,
  value,
  error,
  disabled,
  onChange,
  inputRef,
}: {
  field: FormField;
  value: unknown;
  error: boolean;
  disabled?: boolean;
  onChange: (v: number | undefined) => void;
  inputRef: (el: TextInput | null) => void;
}) {
  const themeColors = useThemeColors();
  const a11y = useA11y(field);
  const external = (v: unknown) => (typeof v === 'number' ? String(v) : '');
  const [text, setText] = useState(external(value));
  const [seen, setSeen] = useState(value);
  // An external change (re-pinned answers) replaces the draft text; our own edits already match it.
  if (value !== seen) {
    setSeen(value);
    if (external(value) !== text && !(value === undefined && text.trim() === '')) setText(external(value));
  }
  return (
    <TextInput
      ref={inputRef}
      className={inputClass(error)}
      {...a11y}
      keyboardType="decimal-pad"
      placeholderTextColor={themeColors.mutedForeground}
      value={text}
      editable={!disabled}
      onChangeText={(raw) => {
        setText(raw);
        const normalized = raw.trim().replace(',', '.');
        if (normalized === '') {
          onChange(undefined);
          return;
        }
        const n = Number(normalized);
        // `-`, `1.` and the like are unfinished: keep the text, report nothing.
        if (Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(normalized)) onChange(n);
      }}
    />
  );
}

/** A square check mark used by checkbox, multiselect and consent rows. */
function CheckBox({ checked, error }: { checked: boolean; error?: boolean }) {
  const themeColors = useThemeColors();
  return (
    <View
      className={`w-6 h-6 rounded-md border-2 items-center justify-center ${
        checked ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : error ? 'border-destructive' : 'border-border dark:border-border-dark'
      }`}
    >
      {checked ? <Check size={16} color={themeColors.primaryForeground} /> : null}
    </View>
  );
}

function OptionRow({
  label,
  selected,
  role,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  role: 'radio' | 'checkbox';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      className="flex-row items-center py-2"
      style={{ minHeight: 44, gap: 10 }}
    >
      {role === 'checkbox' ? (
        <CheckBox checked={selected} />
      ) : (
        <View
          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
            selected ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
          }`}
        >
          {selected ? <View className="w-3 h-3 rounded-full bg-primary dark:bg-primary-dark" /> : null}
        </View>
      )}
      <Text className="flex-1 text-base text-foreground dark:text-foreground-dark">{label}</Text>
    </TouchableOpacity>
  );
}

function SelectField({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: FormField;
  value: unknown;
  error: boolean;
  disabled?: boolean;
  onChange: (v: string | undefined) => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const a11y = useA11y(field);
  const [open, setOpen] = useState(false);
  const options = field.options ?? [];
  const selected = typeof value === 'string' ? value : '';
  const selectedLabel = options.find((o) => o.value === selected)?.label;

  if (options.length <= INLINE_OPTION_LIMIT) {
    return (
      <View accessibilityRole="radiogroup" {...a11y}>
        {options.map((o) => (
          <OptionRow
            key={o.value}
            label={o.label}
            role="radio"
            selected={o.value === selected}
            disabled={disabled}
            onPress={() => onChange(o.value === selected && !field.required ? undefined : o.value)}
          />
        ))}
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${a11y.accessibilityLabel}: ${selectedLabel ?? t('forms.select.placeholder')}`}
        accessibilityHint={a11y.accessibilityHint}
        className={`flex-row items-center justify-between ${inputClass(error)}`}
        style={{ minHeight: 44 }}
      >
        <Text
          className={`flex-1 text-base ${selectedLabel ? 'text-foreground dark:text-foreground-dark' : 'text-muted-foreground dark:text-muted-foreground-dark'}`}
        >
          {selectedLabel ?? t('forms.select.placeholder')}
        </Text>
        <ChevronDown size={18} color={themeColors.mutedForeground} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable className="flex-1" onPress={() => setOpen(false)} accessibilityLabel={t('forms.select.close')} />
          <View className="bg-background dark:bg-background-dark rounded-t-3xl px-5 pt-4 pb-6" style={{ maxHeight: '75%' }}>
            <Text className="text-foreground dark:text-foreground-dark text-lg font-bold mb-2">{field.label}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((o) => (
                <OptionRow
                  key={o.value}
                  label={o.label}
                  role="radio"
                  selected={o.value === selected}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                />
              ))}
            </ScrollView>
            <View className="flex-row mt-3" style={{ gap: 10 }}>
              {!field.required && selected ? (
                <TouchableOpacity
                  onPress={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                  className="flex-1 border border-border dark:border-border-dark rounded-xl py-3 items-center"
                  accessibilityRole="button"
                >
                  <Text className="text-foreground dark:text-foreground-dark font-semibold">{t('forms.select.clear')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setOpen(false)}
                className="flex-1 bg-primary dark:bg-primary-dark rounded-xl py-3 items-center"
                accessibilityRole="button"
              >
                <Text className="text-primary-foreground dark:text-primary-foreground-dark font-bold">{t('forms.select.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function PrivacyBlock({ text, title }: { text: string; title?: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  return (
    <View
      className="rounded-xl border-2 border-primary/40 dark:border-primary-dark/40 bg-primary/5 dark:bg-primary-dark/5 p-4"
      accessibilityRole="summary"
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <ShieldCheck size={20} color={themeColors.primary} />
        <Text className="flex-1 text-sm font-bold text-foreground dark:text-foreground-dark" accessibilityRole="header">
          {title || t('forms.privacy.title')}
        </Text>
      </View>
      {/* Plain text on purpose: texts come from the club's form definition and are never interpreted as markup. */}
      <Text className="mt-2 text-sm text-foreground dark:text-foreground-dark" selectable>
        {text}
      </Text>
    </View>
  );
}

interface UploadFieldProps {
  field: FormField;
  files: FormFile[];
  error?: FieldErrorCode;
  disabled?: boolean;
  onUploadFile: NonNullable<FormRendererProps['onUploadFile']>;
  onRemoveFile?: FormRendererProps['onRemoveFile'];
  onFilesExpired?: () => void;
}

/** `image` (one photo with preview) and `file` (up to the backend's limit; photos only on mobile) fields. */
function UploadField({ field, files, error, disabled, onUploadFile, onRemoveFile, onFilesExpired }: UploadFieldProps) {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const a11y = useA11y(field);
  const image = field.type === 'image';
  const own = files.filter((f) => f.fieldKey === field.key);
  const current = image ? own[0] : undefined;
  const [progress, setProgress] = useState<number | null | undefined>(undefined);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const busy = progress !== undefined;
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const expiredSignalled = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Leaving the form (mode switch, other club) cancels an upload that is still running.
      controller.current?.abort();
    };
  }, []);

  const upload = useCallback(
    async (asset: PickedAsset) => {
      const problem = checkFieldFile(field, { type: asset.type, size: asset.fileSize });
      if (problem) {
        // No upload starts, so nobody else deletes the picker's cache copy.
        discardPickerFile(asset.uri);
        setUploadError(t(problem === 'file_type' ? 'forms.err.field.file_type' : 'forms.err.fileSize'));
        return;
      }
      setUploadError(null);
      setProgress(0);
      if (image) setLocalUri(asset.uri);
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        await onUploadFile(field.key, asset, (p) => alive.current && setProgress(p), ctrl.signal);
      } catch (err) {
        if (alive.current && !ctrl.signal.aborted) setUploadError(t(formErrorKey(err)));
      } finally {
        if (controller.current === ctrl) controller.current = null;
        if (alive.current) {
          setProgress(undefined);
          // The local preview only bridges the upload; afterwards the signed URL of the stored file is shown.
          setLocalUri(null);
        }
      }
    },
    [field, image, onUploadFile, t],
  );

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        // The system photo picker needs no library permission; only the camera asks.
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            if (alive.current) setUploadError(t('forms.file.cameraDenied'));
            return;
          }
        }
        // Photo fields get the system crop (square); documents are taken as they are.
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          quality: 0.8,
          ...(image ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}),
        };
        const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        const asset = result.canceled ? undefined : result.assets[0];
        if (!asset) return;
        if (!alive.current) {
          discardPickerFile(asset.uri);
          return;
        }
        const name = asset.fileName ?? (image ? 'foto.jpg' : 'dokument.jpg');
        await upload({ uri: asset.uri, name, type: normalizeImageMime(asset.mimeType, name), fileSize: asset.fileSize });
      } catch {
        if (alive.current) setUploadError(t('forms.file.pickFailed'));
      }
    },
    [image, t, upload],
  );

  const choose = () => {
    if (busy || disabled) return;
    setUploadError(null);
    Alert.alert(t('forms.file.sheetTitle'), undefined, [
      { text: t('forms.file.camera'), onPress: () => void pick('camera') },
      { text: t('forms.file.library'), onPress: () => void pick('library') },
      { text: t('forms.file.cancelChoose'), style: 'cancel' },
    ]);
  };

  const remove = async (file: FormFile) => {
    if (!onRemoveFile) return;
    setRemoving(file.id);
    setUploadError(null);
    try {
      await onRemoveFile(file);
    } catch (err) {
      if (alive.current) setUploadError(t(formErrorKey(err)));
    } finally {
      if (alive.current) setRemoving(null);
    }
  };

  const previewUri = busy ? localUri : current?.url && current.url !== failedUrl ? current.url : null;

  const cancelButton = (
    <TouchableOpacity
      onPress={() => controller.current?.abort()}
      accessibilityRole="button"
      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{t('forms.file.cancel')}</Text>
    </TouchableOpacity>
  );

  return (
    <FieldShell field={field} error={error} extraError={uploadError}>
      <View style={{ gap: 8 }} accessibilityLabel={a11y.accessibilityLabel}>
        {image ? (
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="w-24 h-24 rounded-xl overflow-hidden border border-border dark:border-border-dark bg-muted dark:bg-muted-dark items-center justify-center">
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityLabel={t('forms.image.alt', { label: field.label })}
                  onError={() => {
                    // Signed URLs are short-lived: ask the owner for fresh ones once per failure streak.
                    if (!busy && current?.url) {
                      setFailedUrl(current.url);
                      if (!expiredSignalled.current) {
                        expiredSignalled.current = true;
                        onFilesExpired?.();
                      }
                    }
                  }}
                  onLoad={() => {
                    expiredSignalled.current = false;
                  }}
                />
              ) : (
                <Camera size={30} color={themeColors.mutedForeground} />
              )}
            </View>
            <View className="flex-1" style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={choose}
                disabled={disabled || busy}
                accessibilityRole="button"
                className={`border border-border dark:border-border-dark rounded-lg px-3 items-center justify-center ${disabled || busy ? 'opacity-60' : ''}`}
                style={{ minHeight: 44 }}
              >
                <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                  {current ? t('forms.image.change') : t('forms.image.choose')}
                </Text>
              </TouchableOpacity>
              {current && onRemoveFile ? (
                <TouchableOpacity
                  onPress={() => void remove(current)}
                  disabled={disabled || busy || removing === current.id}
                  accessibilityRole="button"
                  className={`border border-border dark:border-border-dark rounded-lg px-3 items-center justify-center ${disabled || busy || removing ? 'opacity-60' : ''}`}
                  style={{ minHeight: 44 }}
                >
                  <Text className="text-destructive text-sm font-semibold">{t('forms.file.remove')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            {own.map((f) => (
              <View
                key={f.id}
                className="flex-row items-center justify-between border border-border dark:border-border-dark rounded-lg px-3"
                style={{ minHeight: 48, gap: 8 }}
              >
                <FileText size={16} color={themeColors.mutedForeground} />
                <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark" numberOfLines={1}>
                  {f.filename}
                </Text>
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{formatBytes(f.sizeBytes, language)}</Text>
                {onRemoveFile ? (
                  <TouchableOpacity
                    onPress={() => void remove(f)}
                    disabled={disabled || busy || removing === f.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('forms.file.removeNamed', { name: f.filename })}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={18} color={themeColors.destructive} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            <TouchableOpacity
              onPress={choose}
              disabled={disabled || busy}
              accessibilityRole="button"
              className={`border border-border dark:border-border-dark rounded-lg px-3 items-center justify-center ${disabled || busy ? 'opacity-60' : ''}`}
              style={{ minHeight: 44 }}
            >
              <Text className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                {own.length > 0 ? t('forms.file.addAnother') : t('forms.file.choose')}
              </Text>
            </TouchableOpacity>
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
              {t('forms.file.hint', { mb: Math.round(FILE_FIELD_MAX_BYTES / (1024 * 1024)) })}
            </Text>
            {/* PDF needs the website (no document picker without a new dependency, plan open point O5). */}
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{t('forms.file.pdfHint')}</Text>
          </>
        )}
        {busy ? (
          <View className="flex-row items-center" style={{ gap: 8 }} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={themeColors.primary} />
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
              {progress === null || progress === undefined ? t('forms.file.uploading') : t('forms.file.uploadingPercent', { percent: progress })}
            </Text>
            {cancelButton}
          </View>
        ) : null}
      </View>
    </FieldShell>
  );
}

/**
 * Renders a form definition (Wave 8 M1): every field type, `visibleIf`, per-field errors, photo upload with progress. A
 * controlled component: the caller owns `answers`/`files`, validates and talks to the backend; used by the application
 * flow and meant for the exit form and custom fields later. All text of the definition (labels, help, options, privacy
 * notice) is rendered as plain `Text` -- there is no markup path. Photos and "documents" come from `expo-image-picker`
 * only (JPEG/PNG; PDF needs the website, shown as a hint); dates use the existing `DateTimeField`.
 */
export default function FormRenderer({
  fields,
  privacyNotice,
  answers,
  onChange,
  errors = {},
  files = [],
  disabled = false,
  onUploadFile,
  onRemoveFile,
  onFilesExpired,
  handleRef,
}: FormRendererProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const shown = visibleFields(fields, answers);
  // Placed against the VISIBLE fields: right above the first visible consent, else at the end.
  const noticeAt = privacyNoticeIndex(shown, privacyNotice);
  const inputs = useRef<Record<string, TextInput | null>>({});

  useImperativeHandle(handleRef, () => ({ focusField: (key: string) => inputs.current[key]?.focus() }), []);

  const setInput = (key: string) => (el: TextInput | null) => {
    inputs.current[key] = el;
  };

  function renderField(field: FormField) {
    const error = errors[field.key];
    const value = answers[field.key];
    const v = field.validation;

    switch (field.type) {
      case 'info':
        if (field.infoKind === 'privacy_notice') return <PrivacyBlock text={(field.text ?? '').trim() || privacyNotice || ''} title={field.label} />;
        return (
          <View className="flex-row rounded-lg border border-border dark:border-border-dark bg-muted/40 dark:bg-muted-dark/40 p-3" style={{ gap: 8 }}>
            <Info size={16} color={themeColors.mutedForeground} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{field.label}</Text>
              {field.text ? <Text className="text-sm mt-1 text-muted-foreground dark:text-muted-foreground-dark">{field.text}</Text> : null}
            </View>
          </View>
        );

      case 'text':
      case 'textarea':
        return (
          <FieldShell field={field} error={error} labelledByControl>
            <TextInput
              ref={setInput(field.key)}
              className={inputClass(Boolean(error))}
              accessibilityLabel={field.required ? `${field.label}, ${t('forms.required')}` : field.label}
              accessibilityHint={field.helpText || undefined}
              style={field.type === 'textarea' ? { minHeight: 96, textAlignVertical: 'top' } : undefined}
              multiline={field.type === 'textarea'}
              maxLength={v?.maxLength ?? (field.type === 'textarea' ? 5000 : 200)}
              keyboardType={v?.pattern === 'email' ? 'email-address' : v?.pattern === 'phone' ? 'phone-pad' : v?.pattern === 'postal_code' ? 'number-pad' : 'default'}
              autoCapitalize={v?.pattern === 'email' ? 'none' : field.type === 'textarea' ? 'sentences' : 'words'}
              autoCorrect={v?.pattern !== 'email'}
              placeholderTextColor={themeColors.mutedForeground}
              value={typeof value === 'string' ? value : ''}
              editable={!disabled}
              onChangeText={(text) => onChange(field.key, text)}
            />
          </FieldShell>
        );

      case 'number':
        return (
          <FieldShell field={field} error={error} labelledByControl>
            <NumberInput
              field={field}
              value={value}
              error={Boolean(error)}
              disabled={disabled}
              inputRef={setInput(field.key)}
              onChange={(n) => onChange(field.key, n)}
            />
          </FieldShell>
        );

      case 'date':
        return (
          <FieldShell field={field} error={error}>
            <DateTimeField
              mode="date"
              clearable
              placeholder={t('forms.date.placeholder')}
              value={typeof value === 'string' ? fromDateString(value) : null}
              onChange={(d) => !disabled && onChange(field.key, d ? toDateString(d) : undefined)}
            />
          </FieldShell>
        );

      case 'select':
        return (
          <FieldShell field={field} error={error} labelledByControl>
            <SelectField field={field} value={value} error={Boolean(error)} disabled={disabled} onChange={(next) => onChange(field.key, next)} />
          </FieldShell>
        );

      case 'multiselect': {
        const selected = Array.isArray(value) ? (value as unknown[]).filter((x): x is string => typeof x === 'string') : [];
        return (
          <FieldShell field={field} error={error}>
            <View accessibilityLabel={field.label}>
              {(field.options ?? []).map((o) => (
                <OptionRow
                  key={o.value}
                  label={o.label}
                  role="checkbox"
                  selected={selected.includes(o.value)}
                  disabled={disabled}
                  onPress={() => onChange(field.key, selected.includes(o.value) ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
                />
              ))}
            </View>
          </FieldShell>
        );
      }

      case 'checkbox':
      case 'consent': {
        const consent = field.type === 'consent';
        const checked = value === true;
        const label = field.required ? `${field.label}, ${t('forms.required')}` : field.label;
        return (
          <View
            className={consent ? `rounded-xl border-2 p-3 ${error ? 'border-destructive' : 'border-primary/40 dark:border-primary-dark/40'} bg-primary/5 dark:bg-primary-dark/5` : ''}
          >
            <TouchableOpacity
              onPress={() => onChange(field.key, !checked)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled }}
              accessibilityLabel={label}
              accessibilityHint={field.helpText || undefined}
              className="flex-row items-start"
              style={{ gap: 10, minHeight: 44 }}
            >
              <CheckBox checked={checked} error={Boolean(error)} />
              <Text className={`flex-1 text-sm text-foreground dark:text-foreground-dark ${consent ? 'font-medium' : ''}`}>
                {field.label}
                {field.required ? <Text className="text-destructive"> *</Text> : null}
              </Text>
            </TouchableOpacity>
            {field.helpText ? (
              <Text className="text-xs mt-1 text-muted-foreground dark:text-muted-foreground-dark" style={{ paddingLeft: 34 }}>
                {field.helpText}
              </Text>
            ) : null}
            {error ? (
              <Text className="text-destructive text-xs mt-1" style={{ paddingLeft: 34 }} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {t(fieldErrorKey(error))}
              </Text>
            ) : null}
          </View>
        );
      }

      case 'image':
      case 'file':
        return onUploadFile ? (
          <UploadField
            field={field}
            files={files}
            error={error}
            disabled={disabled}
            onUploadFile={onUploadFile}
            onRemoveFile={onRemoveFile}
            onFilesExpired={onFilesExpired}
          />
        ) : (
          <FieldShell field={field} error={error}>
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{t('forms.file.unavailable')}</Text>
          </FieldShell>
        );

      default:
        return null;
    }
  }

  return (
    <View style={{ gap: 20 }}>
      {shown.map((field, index) => (
        <Fragment key={field.key}>
          {noticeAt === index && privacyNotice ? <PrivacyBlock text={privacyNotice} /> : null}
          {renderField(field)}
        </Fragment>
      ))}
      {noticeAt !== null && noticeAt >= shown.length && privacyNotice ? <PrivacyBlock text={privacyNotice} /> : null}
    </View>
  );
}
