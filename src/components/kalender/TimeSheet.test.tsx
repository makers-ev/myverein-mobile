import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import TimeSheet from './TimeSheet';

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

function running(hoursAgo: number) {
  return { id: 'r1', clubMemberId: 'cm', displayName: null, eventId: null, eventTitle: null, startedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), endedAt: null, minutes: null, running: true, source: 'stempeln', status: 'offen', confirmedAt: null };
}

function setup(entry: ReturnType<typeof running> | null) {
  apiFetchMock.mockReset().mockImplementation(async (path: string, opts?: { method?: string }) => {
    if (path.startsWith('/time-entries/current')) return { data: entry };
    if (opts?.method === 'DELETE') return { data: { ok: true } };
    return { data: [] };
  });
  return render(
    <LanguageProvider>
      <TimeSheet visible onClose={() => undefined} clubId="club" />
    </LanguageProvider>,
  );
}

describe('TimeSheet running entry', () => {
  it('shows no hint for a short running entry but still offers to discard', async () => {
    const screen = await setup(running(2));
    await act(async () => {});
    expect(screen.queryByText(/Did you forget to stop/)).toBeNull();
    expect(screen.getByText('Discard entry')).toBeTruthy();
  });

  it('asks "did you forget to stop?" from 8 h', async () => {
    const screen = await setup(running(9));
    await act(async () => {});
    expect(screen.getByText(/Did you forget to stop/)).toBeTruthy();
  });

  it('shows the hint instead of a dead end for a 328 h entry and discards it after confirming', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Discard entry')?.onPress?.();
    });
    const screen = await setup(running(328));
    await act(async () => {});
    expect(screen.getByText(/Did you forget to stop/)).toBeTruthy();
    expect(screen.getByText(/runs longer than 16 hours/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Discard entry'));
    });
    await act(async () => {});
    expect(alert).toHaveBeenCalled();
    expect(apiFetchMock).toHaveBeenCalledWith('/time-entries/r1?clubId=club', { method: 'DELETE' });
    alert.mockRestore();
  });

  it('does not delete when the dialog is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    const screen = await setup(running(20));
    await act(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByText('Discard entry'));
    });
    expect(apiFetchMock.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false);
    alert.mockRestore();
  });

  it('lets a stuck entry be ended afterwards with the end time bounded by the server', async () => {
    const entry = { ...running(40), overdue: true, maxEndedAt: new Date(Date.now() - 24 * 3_600_000).toISOString() };
    const screen = await setup(entry);
    await act(async () => {});
    expect(screen.queryByText('Stop clock')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText('Enter end time'));
    });
    expect(screen.getByText(/Pick a time between/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Use the latest possible end'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Save end time'));
    });
    await act(async () => {});
    const call = apiFetchMock.mock.calls.find((c) => String(c[0]).startsWith('/time-entries/clock-out'));
    expect(call?.[1].body.endedAt).toBe(entry.maxEndedAt);
  });

  it('opens the end form when the server answers needs_end_time', async () => {
    const screen = await setup(running(5));
    await act(async () => {});
    apiFetchMock.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path.startsWith('/time-entries/clock-out')) throw new ApiError(409, 'CONFLICT', 'x', { code: 'needs_end_time' });
      if (path.startsWith('/time-entries/current')) return { data: { ...running(20), overdue: true } };
      return { data: [] };
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Stop clock'));
    });
    await act(async () => {});
    expect(screen.getByText(/Pick a time between/)).toBeTruthy();
  });
});
