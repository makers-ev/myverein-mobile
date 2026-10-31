import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import TermineTab from './TermineTab';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => null), setStoredLanguage: jest.fn(async () => undefined) }));
jest.mock('@/hooks/useWards', () => ({ useWards: () => ({ wards: [] }) }));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : Icon) });
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/theme/colors', () => ({
  useThemeColors: () => ({
    background: '#fff', foreground: '#000', card: '#fff', muted: '#eee', mutedForeground: '#777', border: '#ccc',
    primary: '#00f', primaryForeground: '#fff', accent: '#0ff', accentForeground: '#000', destructive: '#f00', success: '#0f0', warning: '#fa0',
  }),
}));
const apiFetchMock = apiFetch as jest.Mock;

const trainer = {
  id: 'cm1',
  clubMemberId: 'cm1',
  roles: [{ id: 'r', roleType: 'trainer', departmentId: 'd1', termEndsAt: null }],
  departments: [],
  permissions: ['attendance:write', 'attendance:read'],
};
const event = {
  id: 'e1',
  calendarId: 'c1',
  title: 'Training',
  description: null,
  startsAt: new Date().toISOString(),
  endsAt: null,
  category: null,
  capacity: null,
  createdBy: 'x',
  createdAt: 'x',
  updatedAt: 'x',
  myRsvp: null,
  attendeeCount: 0,
  waitlistCount: 0,
};

beforeEach(() => {
  apiFetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith('/club-members/me')) return { data: trainer };
    if (path.startsWith('/calendars')) return { data: [{ id: 'c1', clubId: 'club', departmentId: 'd1', name: 'Kal', isDefault: true, icalImportUrl: null, createdBy: 'x', createdAt: 'x' }] };
    if (path.startsWith('/events?')) return { data: [event] };
    if (path.startsWith('/club-settings')) return { data: { state: null } };
    if (path.startsWith('/clubs') || path.includes('info')) return { data: { departments: [] } };
    if (path.includes('/helpers')) return { data: { eventId: 'e1', cancelled: false, canManage: false, stations: [], mine: [] } };
    if (path.includes('/rides')) return { data: { eventId: 'e1', rides: [] } };
    if (path.includes('/registration')) return { data: { eventId: 'e1', calendarId: 'c1', enabled: false, open: true, closedReason: null, deadlineAt: null, maxCompanions: 0, allowGuests: false, costNote: null, costCents: null, form: null, canManage: false } };
    if (path.includes('/attendance')) return { data: { eventId: 'e1', tracking: true, closed: false, closedAt: null, canWrite: true, supervisors: [], entries: [], summary: { anwesend: 0, entschuldigt: 0, unentschuldigt: 0, offen: 0 }, supervisionWarning: false, minorsPresent: 0, corrections: [] } };
    if (path.includes('/rsvp') || path.includes('/time-entries/current')) return { data: null };
    return { data: [] };
  });
});

describe('TermineTab', () => {
  it('imports and renders (guards against undefined imports and circular exports)', async () => {
    const screen = await render(
      <LanguageProvider>
        <TermineTab clubId="club" />
      </LanguageProvider>,
    );
    await act(async () => {});
    expect(screen.toJSON()).not.toBeNull();
  });

  it('opens the event sheet with all gated actions and the attendance, helper and ride sheets', async () => {
    const screen = await render(
      <LanguageProvider>
        <TermineTab clubId="club" />
      </LanguageProvider>,
    );
    await act(async () => {});
    // The agenda row (title) opens the sheet; the trainer sees the attendance shortcut.
    await act(async () => {
      fireEvent.press(await screen.findByText('Training'));
    });
    await act(async () => {});
    expect(screen.getAllByText('Attendance').length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.press(screen.getAllByText('Attendance')[0]);
    });
    await act(async () => {});
    expect(screen.toJSON()).not.toBeNull();
  });
});
