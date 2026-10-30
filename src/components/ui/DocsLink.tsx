import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { openDocs } from '@/lib/docsUrl';

interface Props {
  /** Docs page below /de/, e.g. `DOCS_PATHS.members`. */
  path: string;
  /** Optional label key override; defaults to "Anleitung ansehen". */
  labelKey?: string;
}

/** Contextual "Anleitung ansehen" link to the docs portal (external browser, 44pt target, role link). */
export default function DocsLink({ path, labelKey = 'docs.link' }: Props) {
  const { t } = useLanguage();
  const label = t(labelKey);
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={t('docs.link.hint')}
      onPress={() => {
        void openDocs(path).then((ok) => {
          if (!ok) Alert.alert(t('docs.open-error.title'), t('docs.open-error.message'));
        });
      }}
      className="self-start justify-center"
      style={{ minHeight: 44, minWidth: 44 }}
    >
      <Text className="text-primary dark:text-primary-dark text-sm font-semibold underline">{label}</Text>
    </TouchableOpacity>
  );
}
