import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { ApiError, apiFetch } from '@/lib/api';
import { LanguageProvider } from '@/contexts/translation/LanguageContext';
import AvailabilityHints from './AvailabilityHints';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test', websiteUrl: 'http://web' }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
jest.mock('@/contexts/translation/languagePreferenceStorage', () => ({ getStoredLanguage: jest.fn(async () => null), setStoredLanguage: jest.fn(async () => undefined) }));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : Icon) });
});
jest.mock('@/theme/colors', () => ({ useThemeColors: () => ({ mutedForeground: '#777', primaryText: '#00f' }) }));
const apiFetchMock = apiFetch as jest.Mock;

const answer = (over: Record<string, unknown> = {}) => ({
  data: {
    calendarId: 'cal', eventId: null, startsAt: 's', endsAt: null, timezone: 'Europe/Berlin', pool: 'department',
    counts: { total: 18, verfuegbar: 12, nicht_verfuegbar: 2, unbekannt: 4 },
    includesNames: true, unavailablePeople: [{ clubMemberId: '1', displayName: 'Zoe' }, { clubMemberId: '2', displayName: 'Anna' }], truncated: false, ...over,
  },
});

const props = { clubId: 'club', calendarId: 'cal', startsAt: '2026-06-10T16:00:00.000Z', endsAt: '2026-06-10T18:00:00.000Z' };
const mount = (p = props) => render(<LanguageProvider><AvailabilityHints {...p} /></LanguageProvider>);

beforeEach(() => {
  jest.useFakeTimers();
  apiFetchMock.mockReset();
});
afterEach(() => jest.useRealTimers());

const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
  await act(async () => {});
};

describe('AvailabilityHints', () => {
  it('shows counters, unknown note and expandable names for managers', async () => {
    apiFetchMock.mockResolvedValue(answer());
    const screen = await mount();
    await settle();
    expect(screen.getByText('12 of 18 available')).toBeTruthy();
    expect(screen.getByText(/4 unknown \(no entries\)/)).toBeTruthy();
    expect(screen.queryByText('Anna')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText('Who is not available? (2)'));
    });
    expect(screen.getByText('Anna')).toBeTruthy();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows only counters when the backend sends no names', async () => {
    apiFetchMock.mockResolvedValue(answer({ includesNames: false, unavailablePeople: null }));
    const screen = await mount();
    await settle();
    expect(screen.getByText('12 of 18 available')).toBeTruthy();
    expect(screen.queryByText(/Who is not available/)).toBeNull();
  });

  it('never shows names unless includesNames is true, even when the answer carries them', async () => {
    apiFetchMock.mockResolvedValue(answer({ includesNames: false }));
    const screen = await mount();
    await settle();
    expect(screen.getByText('12 of 18 available')).toBeTruthy();
    expect(screen.queryByText(/Who is not available/)).toBeNull();
    expect(screen.queryByText('Anna')).toBeNull();
  });

  it('hides the whole section on 403', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'no'));
    const screen = await mount();
    await settle();
    expect(screen.queryByText('Who is free?')).toBeNull();
  });

  it('shows an error that never blocks saving, with retry', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, 'X', 'x')).mockResolvedValue(answer());
    const screen = await mount();
    await settle();
    expect(screen.getByText(/You can still save/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Try again'));
    });
    await settle();
    expect(screen.getByText('12 of 18 available')).toBeTruthy();
  });

  it('sends nothing for ranges beyond 14 days and debounces changes', async () => {
    const screen = await mount({ ...props, endsAt: '2026-07-30T18:00:00.000Z' });
    await settle();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('There is no hint for periods longer than 14 days.')).toBeTruthy();
    apiFetchMock.mockResolvedValue(answer());
    await screen.rerender(<LanguageProvider><AvailabilityHints {...props} endsAt="2026-06-10T19:00:00.000Z" /></LanguageProvider>);
    await screen.rerender(<LanguageProvider><AvailabilityHints {...props} endsAt="2026-06-10T20:00:00.000Z" /></LanguageProvider>);
    await settle();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops an old answer that arrives after the inputs changed', async () => {
    let resolveFirst: (v: unknown) => void = () => undefined;
    apiFetchMock.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r))).mockResolvedValue(answer({ counts: { total: 5, verfuegbar: 5, nicht_verfuegbar: 0, unbekannt: 0 } }));
    const screen = await mount();
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await screen.rerender(<LanguageProvider><AvailabilityHints {...props} calendarId="cal2" /></LanguageProvider>);
    await act(async () => {
      resolveFirst(answer());
    });
    await settle();
    expect(screen.queryByText('12 of 18 available')).toBeNull();
    expect(screen.getByText('5 of 5 available')).toBeTruthy();
  });
});
