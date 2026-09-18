import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { AuthProvider, useAuth } from './AuthProvider';

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
    authClient.useSession.mockReturnValue({ data: null, isPending: false });
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

  it('isAuthenticated is false while twoFactorPending is true even with a session present', async () => {
    authClient.useSession.mockReturnValue({
      data: { session: { id: 's1' }, user: { id: 'u1', email: 'user@example.com' } },
      isPending: false,
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
});
