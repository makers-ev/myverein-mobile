import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import DateTimeField, { fromDateString, toDateString } from '@/components/ui/DateTimeField';
import FormSheet, { Field, inputClassName } from '@/components/ui/FormSheet';
import { ABSENCE_NOTE_MAX, absencePeriodError, dayKey } from '@/lib/ward';
import type { AbsenceInput, AbsenceKind } from '@/hooks/useAbsences';

interface Props {
  visible: boolean;
  /** Child's first name for a guardian report, null for the own report. */
  wardName: string | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: AbsenceInput) => void;
}

const KINDS: AbsenceKind[] = ['krank', 'abwesend'];

/**
 * Quick sick-note sheet: kind, first and last day, optional short note with the "no diagnoses" hint. Two taps from the
 * section button (open, send). The sheet is unmounted while closed so every opening starts with today and an empty note;
 * the note is local state only and never logged.
 */
export default function AbsenceSheet({ visible, wardName, saving, error, onClose, onSubmit }: Props) {
  if (!visible) return null;
  return <SheetBody wardName={wardName} saving={saving} error={error} onClose={onClose} onSubmit={onSubmit} />;
}

function SheetBody({ wardName, saving, error, onClose, onSubmit }: Omit<Props, 'visible'>) {
  const { t } = useLanguage();
  const [kind, setKind] = useState<AbsenceKind>('krank');
  const [start, setStart] = useState<Date | null>(new Date());
  const [end, setEnd] = useState<Date | null>(new Date());
  const [note, setNote] = useState('');

  const startsOn = start ? toDateString(start) : null;
  const endsOn = end ? toDateString(end) : null;
  const periodError = startsOn && endsOn ? absencePeriodError(startsOn, endsOn) : null;
  const ready = !!startsOn && !!endsOn && !periodError;

  const changeStart = (d: Date | null) => {
    setStart(d);
    // Keep the period valid without an error round-trip: moving the start past the end moves the end along.
    if (d && end && dayKey(d) > dayKey(end)) setEnd(d);
  };

  return (
    <FormSheet
      visible
      title={wardName ? t('absence.sheet.title-ward', { name: wardName }) : t('absence.sheet.title')}
      onClose={onClose}
      onSubmit={() => {
        if (!ready || !startsOn || !endsOn) return;
        onSubmit({ kind, startsOn, endsOn, note: note.trim() === '' ? null : note.trim() });
      }}
      submitLabel={t('absence.submit')}
      submitDisabled={!ready}
      saving={saving}
      error={error ?? (periodError ? t('absence.error.invalid-period') : null)}
    >
      <Field label={t('absence.kind.label')}>
        <View className="flex-row" style={{ gap: 8 }}>
          {KINDS.map((k) => {
            const active = kind === k;
            return (
              <TouchableOpacity
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, checked: active }}
                onPress={() => setKind(k)}
                className={`flex-1 rounded-xl border items-center justify-center ${
                  active ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark' : 'bg-card dark:bg-card-dark border-border dark:border-border-dark'
                }`}
                style={{ minHeight: 44 }}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-primary-foreground dark:text-primary-foreground-dark' : 'text-foreground dark:text-foreground-dark'}`}>
                  {t(`absence.kind.${k}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Field>
      <Field label={t('absence.from')}>
        <DateTimeField mode="date" value={start} onChange={changeStart} />
      </Field>
      <Field label={t('absence.to')}>
        <DateTimeField mode="date" value={end ?? fromDateString(startsOn)} onChange={setEnd} />
      </Field>
      <Field label={t('absence.note.label')}>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={ABSENCE_NOTE_MAX}
          multiline
          accessibilityLabel={t('absence.note.label')}
          accessibilityHint={t('absence.note.hint')}
          placeholder={t('absence.note.placeholder')}
          className={inputClassName}
          style={{ minHeight: 64, textAlignVertical: 'top' }}
        />
        <Text className="text-muted-foreground dark:text-muted-foreground-dark text-xs mt-1">{t('absence.note.hint')}</Text>
      </Field>
    </FormSheet>
  );
}
