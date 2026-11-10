import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Thermometer } from 'lucide-react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { privacyErrorKeyOr } from '@/lib/ward';
import { useAbsences, type AbsenceInput } from '@/hooks/useAbsences';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import AbsenceSheet from './AbsenceSheet';

/**
 * Dashboard action card "Krank melden" (Wave 10 M2): one tap on "Abwesenheit eintragen" opens the sheet, a second sends it. The caller shows it
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
      <Card variant="action" icon={Thermometer} title={t('absence.button')} body={t('absence.card.body')}>
        <View className="self-start">
          <Button
            variant="secondary"
            label={t('absence.card.action')}
            onPress={() => {
              setNotice(null);
              setError(null);
              setOpen(true);
            }}
          />
        </View>
        {notice ? (
          <Text className="text-success dark:text-success-dark text-[15px] mt-3" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
      </Card>
      <AbsenceSheet visible={open} wardName={null} saving={saving} error={error} onClose={() => !saving && setOpen(false)} onSubmit={(i) => void submit(i)} />
    </>
  );
}
