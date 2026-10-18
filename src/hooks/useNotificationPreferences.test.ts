import { act, renderHook } from '@testing-library/react-native';

import { apiFetch } from '@/lib/api';
import { useNotificationPreferences, type NotificationPreferences } from './useNotificationPreferences';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), apiFetch: jest.fn() }));
const apiFetchMock = apiFetch as jest.Mock;

const prefs = (email: boolean): NotificationPreferences => ({
  categories: [
    {
      category: 'announcements',
      channels: [
        { channel: 'in_app', enabled: true, switchable: false },
        { channel: 'email', enabled: email, switchable: true },
      ],
    },
  ],
  mandatory: [{ key: 'account_security', switchable: false }],
});

beforeEach(() => apiFetchMock.mockReset());

describe('useNotificationPreferences', () => {
  it('loads and PUTs a single toggle', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: prefs(true) }).mockResolvedValueOnce({ data: prefs(false) });
    const { result } = await renderHook(() => useNotificationPreferences());
    await act(async () => {});
    let ok = false;
    await act(async () => {
      ok = await result.current.setEnabled('announcements', 'email', false);
    });
    expect(ok).toBe(true);
    expect(apiFetchMock).toHaveBeenLastCalledWith('/notification-preferences', {
      method: 'PUT',
      body: { preferences: [{ category: 'announcements', channel: 'email', enabled: false }] },
    });
    expect(result.current.preferences?.categories[0]?.channels[1]?.enabled).toBe(false);
  });

  it('restores the server state when saving fails', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: prefs(true) })
      .mockRejectedValueOnce(new Error('422'))
      .mockResolvedValueOnce({ data: prefs(true) });
    const { result } = await renderHook(() => useNotificationPreferences());
    await act(async () => {});
    let ok = true;
    await act(async () => {
      ok = await result.current.setEnabled('announcements', 'email', false);
    });
    expect(ok).toBe(false);
    expect(result.current.preferences?.categories[0]?.channels[1]?.enabled).toBe(true);
  });
});
