import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import ExpiryBadge, { formatCredentialDate } from '@/components/forms/ExpiryBadge';
import FormRenderer, { type FormRendererHandle } from '@/components/forms/FormRenderer';
import { navigate } from '@/navigation/navigationRef';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useMemberCustomFields } from '@/hooks/useMemberCustomFields';
import { unverifiedEntryKey } from '@/lib/credentials';
import { contentLang, customFieldErrorKey, displayValue, localizedHelpText, localizedLabel, partitionFields, toFormField, valuesPatch, valuesToAnswers } from '@/lib/customFields';
import { type Answers, type FieldErrorCode, fieldErrorsFromError, validateAnswers } from '@/lib/formSchema';
import { useThemeColors } from '@/theme/colors';

interface Props {
  clubId: string;
  /** `'me'` = the caller's own record (editable where `editable_by = self`), otherwise the `club_members.id` of a member (read-only). */
  target: string;
  /** Show everything as plain values (board looking at another member): nothing can be changed here. */
  readOnlyView?: boolean;
  /** Reports unsaved edits so the parent can guard leaving the tab. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Card styling for the Profil tab; the detail sheet renders it flat. */
  card?: boolean;
  /**
   * Caller may manage profile modules (`forms:write`) and this is the own record: when the club has no active custom fields a
   * hint with a link to "Bausteine" shows instead of nothing. Everybody else still sees nothing.
   */
  manageHint?: boolean;
}

/**
 * Custom fields of one member (Wave 8 M4): what the caller may see (the server decides) and edit. Editable fields
 * (`editable_by = self`, own record only) are rendered with the shared FormRenderer, everything else read-only with option
 * labels; protected fields carry a lock marker. Only changed editable values are sent (`PATCH`, cleared = null). Guests (403)
 * and members without any visible field render nothing. Values are never logged or persisted.
 */
export default function MemberCustomFields({ clubId, target, readOnlyView = false, onDirtyChange, card = false, manageHint = false }: Props) {
  const { t, language } = useLanguage();
  const lang = contentLang(language);
  const themeColors = useThemeColors();
  const { fields, status, reload, save } = useMemberCustomFields(clubId, target);
  const rendererRef = useRef<FormRendererHandle>(null);

  const [saved, setSaved] = useState<Answers>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, FieldErrorCode>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Server values flow into the form when they (re)load; edits typed meanwhile are kept for fields the server did not change.
  const syncedFrom = useRef<Answers>({});
  useEffect(() => {
    if (!fields) {
      syncedFrom.current = {};
      setSaved({});
      setAnswers({});
      return;
    }
    const next = valuesToAnswers(fields);
    const prev = syncedFrom.current;
    syncedFrom.current = next;
    setSaved(next);
    setAnswers((cur) => {
      const merged: Answers = { ...next };
      for (const key of Object.keys(cur)) {
        const untouched = JSON.stringify(cur[key]) === JSON.stringify(prev[key]);
        if (!untouched) merged[key] = cur[key];
      }
      return merged;
    });
    setErrors({});
  }, [fields]);

  const { editable, readOnly } = useMemo(() => partitionFields(fields ?? [], readOnlyView || target !== 'me', target === 'me'), [fields, readOnlyView, target]);
  const renderFields = useMemo(() => editable.map((f) => toFormField(f, lang)), [editable, lang]);
  const patch = fields && editable.length > 0 ? valuesPatch(fields, saved, answers, true) : null;
  const dirty = patch !== null;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const onChange = useCallback((key: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
    setResult(null);
  }, []);

  const handleSave = async () => {
    if (!patch || busy) return;
    const local = validateAnswers(renderFields, answers, { mode: 'draft' });
    const firstKey = Object.keys(local)[0];
    if (firstKey) {
      setErrors(local);
      setResult({ ok: false, text: t('forms.err.fieldsInvalid') });
      rendererRef.current?.focusField(firstKey);
      return;
    }
    setBusy(true);
    setResult(null);
    setErrors({});
    try {
      const fresh = await save(patch);
      if (fresh) setResult({ ok: true, text: t('forms.cf.values.saved') });
    } catch (err) {
      const fieldErrors = fieldErrorsFromError(err);
      if (fieldErrors) setErrors(fieldErrors);
      setResult({ ok: false, text: t(customFieldErrorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  if (status === 'hidden') return null;

  const own = target === 'me';
  const boardView = readOnlyView || !own;
  const wrapper = card ? 'bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl p-4 mb-4' : 'mt-2';
  const title = own ? t('forms.cf.values.titleOwn') : t('forms.cf.values.title');
  const mutedClass = 'text-muted-foreground dark:text-muted-foreground-dark text-xs';

  if (status === 'loading') {
    return (
      <View className={wrapper}>
        <ActivityIndicator color={themeColors.primary} accessibilityLabel={t('forms.cf.values.loading')} />
      </View>
    );
  }
  if (status === 'failed' || !fields) {
    return (
      <View className={wrapper}>
        <Text className="text-destructive text-sm mb-2" accessibilityRole="alert">
          {t('forms.cf.values.loadError')}
        </Text>
        <TouchableOpacity
          onPress={() => void reload()}
          className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('verein.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  // Nothing to show (and nothing hidden from this caller): keep the screen free of an empty box.
  if (fields.length === 0) {
    if (!manageHint || target !== 'me') return null;
    return (
      <View className={wrapper}>
        <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1" accessibilityRole="header">
          {t('forms.pm.hint.title')}
        </Text>
        <Text className={`${mutedClass} mb-3`}>{t('forms.pm.hint.text')}</Text>
        <TouchableOpacity
          onPress={() => navigate('ProfileModules')}
          className="self-start px-4 justify-center rounded-lg border border-border dark:border-border-dark"
          style={{ minHeight: 44 }}
          accessibilityRole="link"
          accessibilityLabel={t('forms.pm.hint.link')}
        >
          <Text className="text-primary dark:text-primary-dark text-sm font-bold">{t('forms.pm.hint.link')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const texts = { yes: t('forms.review.yes'), no: t('forms.review.no'), formatDate: (v: string) => formatCredentialDate(v, language),
    credential: {
      level: (level: string) => t('forms.cred.summary.level', { level }),
      obtained: (date: string) => t('forms.cred.summary.obtained', { date }),
      until: (date: string) => t('forms.cred.summary.until', { date }),
    },
  };
  const sensitiveEditable = editable.filter((f) => f.sensitive);

  return (
    <View className={wrapper}>
      <Text className="text-foreground dark:text-foreground-dark font-bold text-base mb-1" accessibilityRole="header">
        {title}
      </Text>
      <Text className={`${mutedClass} mb-3`}>{own ? t('forms.cf.values.hintOwn') : t('forms.cf.values.hint')}</Text>

      {readOnly.length > 0 ? (
        <View style={{ gap: 8 }}>
          {readOnly.map((f) => {
            const text = displayValue(f, texts);
            const label = localizedLabel(f, lang);
            const helpText = localizedHelpText(f, lang);
            const entryKey = boardView && text !== null ? unverifiedEntryKey(f) : null;
            const hint = readOnlyView || !own ? null : f.editableBy === 'vorstand' ? t('forms.cf.values.readonlyBoard') : null;
            return (
              <View
                key={f.id}
                className="rounded-lg border border-border dark:border-border-dark px-3 py-2"
                accessible
                accessibilityLabel={`${label}${f.sensitive ? `, ${t('forms.cf.sensitive')}` : ''}: ${text ?? t('forms.cf.values.empty')}`}
              >
                <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                  <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">{label}</Text>
                  {f.sensitive ? (
                    <View className="flex-row items-center" style={{ gap: 3 }}>
                      <Lock size={12} color={themeColors.mutedForeground} />
                      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{t('forms.cf.sensitive')}</Text>
                    </View>
                  ) : null}
                </View>
                {/* Plain text: values are member input and never interpreted as markup. */}
                <Text
                  className={`text-sm mt-0.5 ${text === null ? 'text-muted-foreground dark:text-muted-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}
                  selectable
                >
                  {text ?? '—'}
                </Text>
                {f.type === 'credential' && f.expiry ? (
                  <View className="mt-1.5">
                    <ExpiryBadge expiry={f.expiry} />
                  </View>
                ) : null}
                {helpText ? <Text className={`${mutedClass} mt-1`}>{helpText}</Text> : null}
                {hint ? <Text className={`${mutedClass} mt-0.5`}>{hint}</Text> : null}
                {entryKey ? <Text className={`${mutedClass} mt-0.5`}>{t(entryKey)}</Text> : null}
                {boardView && f.enteredBy === 'board' && f.type === 'credential' && text !== null ? <Text className={`${mutedClass} mt-0.5`}>{t('forms.cred.boardEntered')}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {editable.length > 0 ? (
        <View className={readOnly.length > 0 ? 'mt-4' : ''} style={{ gap: 12 }}>
          {sensitiveEditable.length > 0 ? (
            <View className="flex-row items-start" style={{ gap: 6 }}>
              <Lock size={14} color={themeColors.mutedForeground} style={{ marginTop: 2 }} />
              <Text className={`${mutedClass} flex-1`}>{t('forms.cf.values.sensitiveEdit', { fields: sensitiveEditable.map((f) => localizedLabel(f, lang)).join(', ') })}</Text>
            </View>
          ) : null}
          <FormRenderer handleRef={rendererRef} fields={renderFields} answers={answers} errors={errors} onChange={onChange} disabled={busy} />
          {dirty && !busy ? <Text className={mutedClass}>{t('profil.unsaved')}</Text> : null}
          {result ? (
            <Text
              className={`text-sm ${result.ok ? 'text-success dark:text-success-dark' : 'text-destructive'}`}
              accessibilityRole={result.ok ? undefined : 'alert'}
              accessibilityLiveRegion="polite"
            >
              {result.text}
            </Text>
          ) : null}
          <TouchableOpacity
            className={`bg-primary dark:bg-primary-dark rounded-xl py-3 items-center justify-center ${busy || !dirty ? 'opacity-50' : ''}`}
            style={{ minHeight: 48 }}
            onPress={() => void handleSave()}
            disabled={busy || !dirty}
            accessibilityRole="button"
            accessibilityLabel={t('forms.cf.values.save')}
            accessibilityState={{ disabled: busy || !dirty, busy }}
          >
            {busy ? (
              <ActivityIndicator color={themeColors.primaryForeground} />
            ) : (
              <Text className="text-primary-foreground dark:text-primary-foreground-dark text-sm font-bold">{t('forms.cf.values.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
