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
  return { Camera: Icon, Check: Icon, ChevronDown: Icon, ChevronLeft: Icon, ChevronRight: Icon, FileText: Icon, Info: Icon, ShieldCheck: Icon, Trash2: Icon, CalendarDays: Icon };
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
    expect(screen.getByText(/Vorname <b>fett<\/b>/)).toBeTruthy();
    expect(screen.queryByText('Hinweis Eltern')).toBeNull();
  });

  it('shows a conditional field once its condition holds and reports changes', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<FormRenderer fields={FIELDS} answers={{}} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Jugend' }));
    expect(onChange).toHaveBeenCalledWith('category', 'jugend');
    await rerender(<FormRenderer fields={FIELDS} answers={{ category: 'jugend' }} onChange={onChange} />);
    expect(screen.getByText('Hinweis Eltern')).toBeTruthy();
  });

  it('toggles a consent and shows a per-field error with a role of alert', async () => {
    const onChange = jest.fn();
    await render(<FormRenderer fields={FIELDS} answers={{}} errors={{ agree: 'required' }} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: /Ich stimme zu/ }));
    expect(onChange).toHaveBeenCalledWith('agree', true);
    expect(screen.getByText('forms.err.field.required')).toBeTruthy();
  });
});
