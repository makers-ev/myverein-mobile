import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { clearDocumentFileCache } from '@/lib/media';
import { clearAllCardCache } from '@/lib/memberCardCache';
import { unregisterPushToken } from '@/notifications/pushRegistration';
import { AuthProvider, useAuth } from './AuthProvider';

jest.mock('@/notifications/pushRegistration', () => ({
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
  resumePushRegistration: jest.fn(),
}));

jest.mock('@/lib/media', () => ({ clearDocumentFileCache: jest.fn() }));
jest.mock('@/lib/offlineCache', () => ({ clearOfflineCache: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/memberCardCache', () => ({ clearAllCardCache: jest.fn().mockResolvedValue(undefined) }));

jest.mock('./auth-client', () => ({
  authClient: {
    useSession: jest.fn(),
    signIn: { email: jest.fn() },
    signUp: { email: jest.fn() },
    signOut: jest.fn(),
    deleteUser: jest.fn(),
    updateUser: jest.fn(),
    changePassword: jest.fn(),
    listSessions: jest.fn(),
    revokeSession: jest.fn(),
    twoFactor: {
      verifyTotp: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- grabbing the mocked module for per-test configuration
const { authClient } = require('./auth-client');

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// @testing-library/react-native v14's renderHook is async -- `result` is
// undefined until the returned promise resolves, unlike the classic
// react-test-renderer-based v12/v13 API.

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authClient.useSession.mockReturnValue({ data: null, isPending: false, refetch: jest.fn() });
  });

  it('signIn sets twoFactorPending when the response includes twoFactorRedirect', async () => {
    authClient.signIn.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const outcome = await result.current.signIn('user@example.com', 'password123');
      expect(outcome.success).toBe(true);
    });

    expect(result.current.twoFactorPending).toBe(true);
  });

  it('signIn maps a bare 401 to the invalid-credentials code', async () => {
    authClient.signIn.email.mockResolvedValue({ data: null, error: { status: 401 } });

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const outcome = await result.current.signIn('user@example.com', 'wrong');
      expect(outcome).toMatchObject({ success: false, code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 });
    });
  });

  it('isAuthenticated is false while twoFactorPending is true even with a session present', async () => {
    authClient.useSession.mockReturnValue({
      data: { session: { id: 's1' }, user: { id: 'u1', email: 'user@example.com' } },
      isPending: false,
      refetch: jest.fn(),
    });
    authClient.signIn.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });

    const { result } = await renderHook(() => useAuth(), { wrapper });

    // A session already exists, so isAuthenticated would be true without
    // the twoFactorPending override.
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.signIn('user@example.com', 'password123');
    });

    expect(result.current.twoFactorPending).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('signOut clears twoFactorPending state', async () => {
    authClient.signIn.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    authClient.signOut.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn('user@example.com', 'password123');
    });
    expect(result.current.twoFactorPending).toBe(true);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.twoFactorPending).toBe(false);
    expect(authClient.signOut).toHaveBeenCalled();
  });

  it('signOut unregisters the push token before ending the session', async () => {
    const order: string[] = [];
    (unregisterPushToken as jest.Mock).mockImplementationOnce(async () => void order.push('unregister'));
    authClient.signOut.mockImplementationOnce(async () => void order.push('signOut'));

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signOut();
    });

    expect(order).toEqual(['unregister', 'signOut']);
  });

  it('deleteAccount unregisters the push token before deleting the user', async () => {
    const order: string[] = [];
    (unregisterPushToken as jest.Mock).mockImplementationOnce(async () => void order.push('unregister'));
    authClient.deleteUser.mockImplementationOnce(async () => {
      order.push('deleteUser');
      return { error: null };
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.deleteAccount('pw');
    });

    expect(order).toEqual(['unregister', 'deleteUser']);
  });

  it('deleteAccount hands the backend blocker code to the caller', async () => {
    authClient.deleteUser.mockImplementationOnce(async () => ({ error: { code: 'ERASURE_SOLE_OWNER', message: 'Sole owner', status: 400 } }));

    const { result } = await renderHook(() => useAuth(), { wrapper });
    let res: { success: boolean; code?: string } | undefined;
    await act(async () => {
      res = await result.current.deleteAccount('pw');
    });

    expect(res).toMatchObject({ success: false, code: 'ERASURE_SOLE_OWNER' });
  });

  it('wipes the offline card copy when the session ended, but not when the session fetch merely failed offline', async () => {
    authClient.useSession.mockReturnValue({ data: null, isPending: false, error: new Error('Network request failed'), refetch: jest.fn() });
    await renderHook(() => useAuth(), { wrapper });
    expect(clearAllCardCache).not.toHaveBeenCalled();

    authClient.useSession.mockReturnValue({ data: null, isPending: false, error: null, refetch: jest.fn() });
    await renderHook(() => useAuth(), { wrapper });
    expect(clearAllCardCache).toHaveBeenCalled();
    expect(clearDocumentFileCache).toHaveBeenCalledWith();
  });

  it('signOut wipes the offline card copy', async () => {
    authClient.useSession.mockReturnValue({ data: { session: { id: 's' }, user: { id: 'u' } }, isPending: false, error: null, refetch: jest.fn() });
    authClient.signOut.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    expect(clearAllCardCache).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.signOut();
    });
    expect(clearAllCardCache).toHaveBeenCalled();
    expect(clearDocumentFileCache).toHaveBeenCalledWith();
  });
});
