import React from 'react';
import { Linking, Text, View } from 'react-native';

import { useLanguage } from '@/contexts/translation/LanguageContext';
import { safeMailto, safeTel, type SponsorContact } from '@/lib/outreach';

/** A phone / e-mail line that opens the phone or mail app on an explicit tap; shown as plain text when the value is not a clean number/address. */
export function ContactLine({ kind, value }: { kind: 'tel' | 'mail'; value: string }) {
  const { t } = useLanguage();
  const url = kind === 'tel' ? safeTel(value) : safeMailto(value);
  if (!url) return <Text selectable className="text-foreground dark:text-foreground-dark text-[15px] leading-[22px]">{value}</Text>;
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={t(kind === 'tel' ? 'sponsors.detail.call' : 'sponsors.detail.mail', { value })}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      className="text-primary dark:text-primary-dark text-[15px] leading-[22px]"
      style={{ minHeight: 44, textAlignVertical: 'center', paddingVertical: 10 }}
    >
      {value}
    </Text>
  );
}

/** Contact persons of a sponsor: name and role, a "Hauptkontakt" tag, tappable phone and e-mail. */
export function ContactList({ contacts, renderBadge }: { contacts: SponsorContact[]; renderBadge?: (c: SponsorContact) => React.ReactNode }) {
  return (
    <>
      {contacts.map((c) => (
        <View key={c.id} className="mb-2">
          <Text className="text-foreground dark:text-foreground-dark text-[17px] leading-[22px]">
            {c.name}
            {c.role ? ` · ${c.role}` : ''}
          </Text>
          {renderBadge?.(c)}
          {c.phone ? <ContactLine kind="tel" value={c.phone} /> : null}
          {c.email ? <ContactLine kind="mail" value={c.email} /> : null}
        </View>
      ))}
    </>
  );
}
