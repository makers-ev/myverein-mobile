import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, AppState, Text, TouchableOpacity, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

import FormRenderer, { type FormRendererHandle } from '@/components/forms/FormRenderer';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useFormSubmission, type UseFormSubmissionOptions } from '@/hooks/useFormSubmission';
import { fieldErrorKey, type FieldErrorCode } from '@/lib/formSchema';
import { useThemeColors } from '@/theme/colors';

interface Props extends UseFormSubmissionOptions {
  /** Lets the parent wait for a pending autosave before it replaces this form (mode switch, other club). */
  registerFlush: (flush: (() => Promise<void>) | null) => void;
}

/**
 * The application form of one club for one applicant mode (self or child): the renderer plus the draft status line,
 * the "form was updated" notice, the error summary (tap an entry to jump to the field), submit and discard. All draft
 * logic lives in `useFormSubmission`.
 */
export default function ApplicationForm({ registerFlush, ...options }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const form = useFormSubmission(options);
  const rendererRef = useRef<FormRendererHandle>(null);
  const { flush } = form;

  useEffect(() => {
    registerFlush(flush);
    return () => registerFlush(null);
  }, [registerFlush, flush]);

  const { saveState, retrySave } = form;
  const saveStateRef = useRef(saveState);
  useEffect(() => {
    saveStateRef.current = saveState;
  });
  // Backgrounding the app saves what was typed right away; coming back retries a save that failed meanwhile.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void flush();
      else if (saveStateRef.current === 'error') retrySave();
    });
    return () => sub.remove();
  }, [flush, retrySave]);

  const waitingForUpload = form.uploading > 0;
  const busy = form.submitting || form.discarding;
  const { definition, errors } = form;

  const submit = async () => {
    const found = await form.submit();
    const first = definition.fields.find((f) => f.key in found);
    if (first) rendererRef.current?.focusField(first.key);
  };

  const confirmDiscard = () => {
    Alert.alert(t('forms.apply.discard'), t('forms.apply.discard.confirm'), [
      { text: t('ui.cancel'), style: 'cancel' },
      { text: t('forms.apply.discard.yes'), style: 'destructive', onPress: () => void form.discard() },
    ]);
  };

  const saveText =
    form.saveState === 'saving' || form.saveState === 'dirty'
      ? t('forms.apply.saving')
      : form.saveState === 'saved' && form.hasDraft
        ? t('forms.apply.saved')
        : form.saveState === 'error' && form.saveErrorKey
          ? t('forms.apply.saveFailed', { reason: t(form.saveErrorKey) })
          : '';

  // Fields with an error, in form order.
  const errorList = definition.fields
    .filter((f) => f.key in errors)
    .map((f) => ({ key: f.key, label: f.label, code: errors[f.key] as FieldErrorCode }));

  if (form.fatalKey) {
    return (
      <Text className="text-destructive dark:text-destructive-dark text-sm mt-4" accessibilityRole="alert">
        {t(form.fatalKey)}
      </Text>
    );
  }

  return (
    <View className="mt-4">
      <Text className="text-base font-bold text-foreground dark:text-foreground-dark">{definition.name}</Text>
      <Text className="text-xs mt-1 text-muted-foreground dark:text-muted-foreground-dark">{t('forms.apply.requiredLegend')}</Text>

      {form.notice ? (
        <View
          className="mt-3 rounded-lg border border-primary/40 dark:border-primary-dark/40 bg-primary/5 dark:bg-primary-dark/5 p-3"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <RefreshCw size={16} color={themeColors.primary} />
            <Text className="flex-1 text-sm font-semibold text-foreground dark:text-foreground-dark">{t('forms.apply.updated.title')}</Text>
          </View>
          <Text className="text-sm mt-1 text-foreground dark:text-foreground-dark">{t('forms.apply.updated.body')}</Text>
          {form.notice.labels.length > 0 ? (
            <View className="mt-2">
              <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{t('forms.apply.updated.dropped')}</Text>
              {form.notice.labels.map((label) => (
                <Text key={label} className="text-sm text-foreground dark:text-foreground-dark">
                  {'• '}
                  {label}
                </Text>
              ))}
            </View>
          ) : null}
          <TouchableOpacity onPress={form.dismissNotice} accessibilityRole="button" className="mt-2 self-start" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text className="text-primary dark:text-primary-dark text-sm font-semibold">{t('forms.apply.updated.dismiss')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="mt-4">
        <FormRenderer
          handleRef={rendererRef}
          fields={definition.fields}
          privacyNotice={definition.privacyNotice}
          answers={form.answers}
          onChange={form.setAnswer}
          errors={errors}
          files={form.files}
          disabled={busy}
          onUploadFile={form.uploadFile}
          onRemoveFile={form.removeFile}
          onFilesExpired={() => void form.refreshFiles()}
        />
      </View>

      <Text className="text-xs mt-4 text-muted-foreground dark:text-muted-foreground-dark" accessibilityLiveRegion="polite" style={{ minHeight: 16 }}>
        {saveText}
      </Text>

      {form.submitErrorKey || errorList.length > 0 ? (
        <View className="mt-2" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {form.submitErrorKey ? <Text className="text-destructive dark:text-destructive-dark text-sm">{t(form.submitErrorKey)}</Text> : null}
          {errorList.length > 0 ? (
            <View className="mt-1">
              <Text className="text-destructive dark:text-destructive-dark text-sm font-semibold">{t('forms.summary.title')}</Text>
              {errorList.map((e) => (
                <TouchableOpacity
                  key={e.key}
                  onPress={() => rendererRef.current?.focusField(e.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.label}: ${t(fieldErrorKey(e.code))}`}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text className="text-destructive dark:text-destructive-dark text-sm">
                    {'• '}
                    {e.label}: {t(fieldErrorKey(e.code))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {waitingForUpload ? (
        <Text className="text-xs mt-3 text-muted-foreground dark:text-muted-foreground-dark" accessibilityLiveRegion="polite">
          {t('forms.apply.uploadRunning')}
        </Text>
      ) : null}
      <TouchableOpacity
        className={`bg-primary dark:bg-primary-dark rounded-lg py-3.5 items-center mt-4 ${busy || waitingForUpload ? 'opacity-70' : ''}`}
        onPress={() => void submit()}
        disabled={busy || waitingForUpload}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy || waitingForUpload }}
        style={{ minHeight: 48 }}
      >
        {form.submitting ? (
          <ActivityIndicator color={themeColors.primaryForeground} />
        ) : (
          <Text className="text-primary-foreground dark:text-primary-foreground-dark text-base font-bold">{t('forms.apply.submit')}</Text>
        )}
      </TouchableOpacity>
      {form.hasDraft ? (
        <TouchableOpacity
          onPress={confirmDiscard}
          disabled={busy || waitingForUpload}
          accessibilityRole="button"
          className={`items-center mt-2 ${busy ? 'opacity-60' : ''}`}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text className="text-destructive dark:text-destructive-dark text-sm font-semibold">{t('forms.apply.discard')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
