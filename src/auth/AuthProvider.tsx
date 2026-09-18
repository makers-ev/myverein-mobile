import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { authClient, websiteUrl } from './auth-client';

interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

/** Minimal shape of a Better Auth session as returned by `listSessions()`. */
interface SessionSummary {
  id: string;
  token: string;
  createdAt: string | Date;
  userAgent?: string | null;
}

interface EnableTwoFactorResult extends AuthResult {
  /** `otpauth://` URI to render as a QR code / hand to an authenticator app. */
  totpUri?: string;
}

interface ListSessionsResult extends AuthResult {
  sessions: SessionSummary[];
}

interface AuthContextType {
  /** The active Better Auth session, or `null` when signed out. */
  session: typeof authClient.$Infer.Session.session | null;
  user: typeof authClient.$Infer.Session.user | null;
  /** True while the initial session bootstrap is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Re-runs the session fetch immediately (no delay) -- used by AppNavigator's connection-error retry. */
  refetchSession: () => Promise<unknown>;
  /** True once `signIn` reports a user has 2FA enabled and a TOTP code is required. */
  twoFactorPending: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  verifyTwoFactor: (code: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<AuthResult>;
  cancelTwoFactor: () => void;
  /** Updates the signed-in user's display name via Better Auth's `/update-user`. */
  updateProfile: (name: string) => Promise<AuthResult>;
  /** Changes the signed-in user's password via Better Auth's `/change-password`. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  /** Lists all active sessions for the signed-in user. */
  listSessions: () => Promise<ListSessionsResult>;
  /** Revokes a single session by its token (see `listSessions`). */
  revokeSession: (token: string) => Promise<AuthResult>;
  /** Starts 2FA setup; resolves with a TOTP URI that must then be confirmed via `verifyTwoFactor`. */
  enableTwoFactor: (password: string) => Promise<EnableTwoFactorResult>;
  /** Turns 2FA back off. */
  disableTwoFactor: (password: string) => Promise<AuthResult>;
  /** Resends the verification email; the link inside points at the website's `/verify-email` page. */
  resendVerificationEmail: (email: string) => Promise<AuthResult>;
  /**
   * Sends a password-reset email via the backend's `/request-password-reset`
   * (better-auth's `sendResetPassword`, see auth-backend-template/src/auth/auth.ts).
   * The link inside lands on the website's `/reset-password` page (which the
   * backend also uses as its fallback callbackURL when none is given).
   */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, refetch: refetchSession } = authClient.useSession();
  const [twoFactorPending, setTwoFactorPending] = useState(false);

  // @better-auth/expo's post-mutation session refresh can race the native
  // secure-storage write, leaving `isAuthenticated` stale until reload.
  // Force one more refetch shortly after to catch up on its own.
  const scheduleSessionRefetch = useCallback(() => {
    setTimeout(() => {
      void refetchSession();
    }, 300);
  }, [refetchSession]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await authClient.signIn.email({ email, password });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to sign in.' };
    }

    // Better Auth's twoFactor plugin short-circuits the normal session
    // response with `{ twoFactorRedirect: true }` when the account has 2FA
    // enabled (auth-backend-template's twoFactor() plugin). No session
    // exists yet -- the caller must render a code-entry step and call
    // `verifyTwoFactor`.
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      setTwoFactorPending(true);
      return { success: true };
    }

    scheduleSessionRefetch();
    return { success: true };
  }, [scheduleSessionRefetch]);

  const verifyTwoFactor = useCallback(async (code: string): Promise<AuthResult> => {
    const { error } = await authClient.twoFactor.verifyTotp({ code });

    if (error) {
      return { success: false, error: error.message ?? 'Invalid verification code.' };
    }

    setTwoFactorPending(false);
    scheduleSessionRefetch();
    return { success: true };
  }, [scheduleSessionRefetch]);

  const cancelTwoFactor = useCallback(() => {
    setTwoFactorPending(false);
  }, []);

  const signUp = useCallback(async ({ email, password, name }: SignUpInput): Promise<AuthResult> => {
    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: `${websiteUrl}/verify-email`,
    });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to create account.' };
    }

    return { success: true };
  }, []);

  const resendVerificationEmail = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${websiteUrl}/verify-email`,
    });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to resend the verification email.' };
    }

    return { success: true };
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${websiteUrl}/reset-password`,
    });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to send the password reset email.' };
    }

    return { success: true };
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setTwoFactorPending(false);
  }, []);

  const deleteAccount = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await authClient.deleteUser({ password });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to delete account.' };
    }

    scheduleSessionRefetch();
    return { success: true };
  }, [scheduleSessionRefetch]);

  const updateProfile = useCallback(async (name: string): Promise<AuthResult> => {
    const { error } = await authClient.updateUser({ name });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to update profile.' };
    }

    return { success: true };
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      // `revokeOtherSessions: true` matches the website's Settings page --
      // a password change is exactly when you want every *other* device
      // signed out, not just this one.
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        return { success: false, error: error.message ?? 'Unable to change password.' };
      }

      return { success: true };
    },
    [],
  );

  const listSessions = useCallback(async (): Promise<ListSessionsResult> => {
    const { data, error } = await authClient.listSessions();

    if (error) {
      return { success: false, error: error.message ?? 'Unable to load sessions.', sessions: [] };
    }

    return { success: true, sessions: data ?? [] };
  }, []);

  const revokeSession = useCallback(async (token: string): Promise<AuthResult> => {
    const { error } = await authClient.revokeSession({ token });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to revoke session.' };
    }

    return { success: true };
  }, []);

  const enableTwoFactor = useCallback(async (password: string): Promise<EnableTwoFactorResult> => {
    // Mirrors the backend's twoFactor() plugin: enabling requires a
    // password confirmation and only returns a TOTP secret/URI, it does not
    // turn 2FA on by itself -- the caller still has to complete setup with
    // `verifyTwoFactor` (same method used for the login-time challenge).
    const { data, error } = await authClient.twoFactor.enable({ password });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to enable two-factor authentication.' };
    }

    return { success: true, totpUri: data?.totpURI };
  }, []);

  const disableTwoFactor = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await authClient.twoFactor.disable({ password });

    if (error) {
      return { success: false, error: error.message ?? 'Unable to disable two-factor authentication.' };
    }

    return { success: true };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      session: session?.session ?? null,
      user: session?.user ?? null,
      isLoading: isPending,
      refetchSession,
      isAuthenticated: Boolean(session) && !twoFactorPending,
      twoFactorPending,
      signIn,
      verifyTwoFactor,
      signUp,
      signOut,
      deleteAccount,
      cancelTwoFactor,
      updateProfile,
      changePassword,
      listSessions,
      revokeSession,
      enableTwoFactor,
      disableTwoFactor,
      resendVerificationEmail,
      requestPasswordReset,
    }),
    [
      session,
      isPending,
      refetchSession,
      twoFactorPending,
      signIn,
      verifyTwoFactor,
      signUp,
      signOut,
      deleteAccount,
      cancelTwoFactor,
      updateProfile,
      changePassword,
      listSessions,
      revokeSession,
      enableTwoFactor,
      disableTwoFactor,
      resendVerificationEmail,
      requestPasswordReset,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
