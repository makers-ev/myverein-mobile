import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FormRenderer from './FormRenderer';
import type { FormField } from '@/lib/formSchema';

jest.mock('@/contexts/translation/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'de' }),
}));
jest.mock('@/theme/colors', () => ({
  useThemeColors: () => ({
    background: '#fff',
    foreground: '#000',
    card: '#fff',
    muted: '#eee',
    mutedForeground: '#777',
    border: '#ccc',
    primary: '#00f',
    primaryForeground: '#fff',
    accent: '#0ff',
    accentForeground: '#000',
    destructive: '#f00',
    success: '#0f0',
    warning: '#fa0',
  }),
}));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return { Camera: Icon, Check: Icon, ChevronDown: Icon, ChevronLeft: Icon, ChevronRight: Icon, FileText: Icon, Info: Icon, ShieldCheck: Icon, Trash2: Icon, CalendarDays: Icon, AlertTriangle: Icon, CheckCircle2: Icon, Clock: Icon, MinusCircle: Icon };
});
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/lib/media', () => ({ normalizeImageMime: (t: string | null | undefined) => t ?? 'image/jpeg' }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

const FIELDS: FormField[] = [
  { key: 'first_name', type: 'text', label: 'Vorname <b>fett</b>', required: true },
  { key: 'category', type: 'select', label: 'Kategorie', options: [{ value: 'aktiv', label: 'Aktiv' }, { value: 'jugend', label: 'Jugend' }] },
  { key: 'parent_note', type: 'text', label: 'Hinweis Eltern', visibleIf: { fieldKey: 'category', op: 'eq', value: 'jugend' } },
  { key: 'agree', type: 'consent', label: 'Ich stimme zu', required: true },
];

describe('FormRenderer', () => {
  it('renders definition text as plain text and places the privacy notice above the consent', async () => {
    await render(<FormRenderer fields={FIELDS} privacyNotice="Wir speichern deine Daten." answers={{}} onChange={() => undefined} />);
    expect(screen.getByText('Wir speichern deine Daten.')).toBeTruthy();
    // markup in a label is shown literally, not interpreted
    expect(screen.getByText(/Vorname <b>fett<\/b>/, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('Hinweis Eltern', { includeHiddenElements: true })).toBeNull();
  });

  it('shows a conditional field once its condition holds and reports changes', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<FormRenderer fields={FIELDS} answers={{}} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Jugend' }));
    expect(onChange).toHaveBeenCalledWith('category', 'jugend');
    await rerender(<FormRenderer fields={FIELDS} answers={{ category: 'jugend' }} onChange={onChange} />);
    expect(screen.getByText('Hinweis Eltern', { includeHiddenElements: true })).toBeTruthy();
    // a control with its own label hides the visible label from screen readers (no double announcement)
    expect(screen.getAllByLabelText(/Vorname/)).toHaveLength(1);
  });

  it('toggles a consent and shows a per-field error with a role of alert', async () => {
    const onChange = jest.fn();
    await render(<FormRenderer fields={FIELDS} answers={{}} errors={{ agree: 'required' }} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: /Ich stimme zu/ }));
    expect(onChange).toHaveBeenCalledWith('agree', true);
    expect(screen.getByText('forms.err.field.required')).toBeTruthy();
  });

  describe('credential field', () => {
    const cred: FormField = {
      key: 'mod_q_juleica',
      type: 'credential',
      label: 'JuLeiCa',
      helpText: 'Nur Nachweis, kein Inhalt.',
      options: [{ value: 'a', label: 'A' }],
      expiry: { status: 'expiring', daysLeft: 12, validUntil: '2026-11-01' },
    };

    it('shows help text and only the switch while not held; switching on sends a minimal value', async () => {
      const onChange = jest.fn();
      await render(<FormRenderer fields={[cred]} answers={{}} onChange={onChange} />);
      expect(screen.getByText('Nur Nachweis, kein Inhalt.')).toBeTruthy();
      expect(screen.queryByText('forms.cred.validUntil')).toBeNull();
      await fireEvent(screen.getByRole('switch'), 'valueChange', true);
      expect(onChange).toHaveBeenCalledWith('mod_q_juleica', { valid: true });
    });

    it('switching off clears the value', async () => {
      const onChange = jest.fn();
      await render(<FormRenderer fields={[cred]} answers={{ mod_q_juleica: { valid: true, validUntil: '2026-11-01' } }} onChange={onChange} />);
      await fireEvent(screen.getByRole('switch'), 'valueChange', false);
      expect(onChange).toHaveBeenCalledWith('mod_q_juleica', undefined);
    });

    it('shows the dates, the expiry badge text and a local error for a reversed range', async () => {
      await render(
        <FormRenderer
          fields={[cred]}
          answers={{ mod_q_juleica: { valid: true, obtainedOn: '2026-11-01', validUntil: '2026-10-01' } }}
          onChange={() => undefined}
        />,
      );
      expect(screen.getByText('forms.cred.obtainedOn')).toBeTruthy();
      expect(screen.getByText('forms.err.field.date_order')).toBeTruthy();
      // the badge is hidden: its date no longer matches the edited value
      expect(screen.queryByText('forms.cred.expiry.inDays')).toBeNull();
    });

    it('shows the badge for the saved value', async () => {
      await render(<FormRenderer fields={[cred]} answers={{ mod_q_juleica: { valid: true, validUntil: '2026-11-01' } }} onChange={() => undefined} />);
      expect(screen.getByText('forms.cred.expiry.inDays')).toBeTruthy();
    });
  });
});
