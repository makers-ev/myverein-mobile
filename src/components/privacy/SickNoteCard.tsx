import React, { useState } from 'react';
import { Text } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { privacyErrorKeyOr } from '@/lib/ward';
import { useAbsences, type AbsenceInput } from '@/hooks/useAbsences';
import BentoTile from '@/components/ui/BentoTile';
import AbsenceSheet from './AbsenceSheet';

/**
 * Dashboard quick action "Krank melden" (Wave 10 M2): one tap opens the sheet, a second sends it. The caller shows it
 * only for a club member (own membership loaded). The saved report is listed in the Profil tab ("Zurückziehen").
 */
export default function SickNoteCard({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { create } = useAbsences({ kind: 'self', clubId });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (input: AbsenceInput) => {
    setSaving(true);
    setError(null);
    const res = await create(input);
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setNotice(t('absence.sent'));
    } else {
      setError(t(privacyErrorKeyOr(res.error, 'absence.error.generic')));
    }
  };

  return (
    <>
      <BentoTile
        minHeight={88}
        accessibilityLabel={t('absence.button')}
        onPress={() => {
          setNotice(null);
          setError(null);
          setOpen(true);
        }}
      >
        <Text className="text-primary dark:text-primary-dark text-xs font-bold uppercase tracking-wider mb-2">{t('absence.title')}</Text>
        <Text className="text-foreground dark:text-foreground-dark text-lg font-bold">{t('absence.button')}</Text>
        {notice ? (
          <Text className="text-success dark:text-success-dark text-sm mt-2" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
      </BentoTile>
      <AbsenceSheet visible={open} wardName={null} saving={saving} error={error} onClose={() => !saving && setOpen(false)} onSubmit={(i) => void submit(i)} />
    </>
  );
}
