import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearDocumentFileCache } from '@/lib/media';
import { clearAllCardCache } from '@/lib/memberCardCache';
import { clearOfflineCache } from '@/lib/offlineCache';

import { resumePushRegistration, unregisterPushToken } from '@/notifications/pushRegistration';
import { authClient, websiteUrl } from './auth-client';

interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
  /** Machine-readable backend/Better Auth code when there is one (e.g. `ERASURE_SOLE_OWNER`); never shown raw. */
  code?: string;
  /** HTTP status of the failed call (0 = no connection); lets the UI pick a localised text. */
  status?: number;
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

/** Failed Better Auth call as a result: fixed English `error` (developer text, never shown) plus `code`/`status` for `mapApiError`. */
function failure(error: { code?: unknown; status?: number }, message: string): AuthResult {
  return { success: false, error: message, code: typeof error.code === 'string' ? error.code : undefined, status: error.status };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, error: sessionError, refetch: refetchSession } = authClient.useSession();
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
      // A bare 401 from the sign-in call (no error code) means wrong e-mail or password.
      const code = typeof error.code === 'string' && error.code ? error.code : error.status === 401 ? 'INVALID_EMAIL_OR_PASSWORD' : undefined;
      return { ...failure({ ...error, code }, 'Unable to sign in.') };
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
      return { ...failure(error, 'Invalid verification code.') };
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
      return { ...failure(error, 'Unable to create account.') };
    }

    return { success: true };
  }, []);

  const resendVerificationEmail = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${websiteUrl}/verify-email`,
    });

    if (error) {
      return { ...failure(error, 'Unable to resend the verification email.') };
    }

    return { success: true };
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${websiteUrl}/reset-password`,
    });

    if (error) {
      return { ...failure(error, 'Unable to send the password reset email.') };
    }

    return { success: true };
  }, []);

  // The offline membership-card copy must not outlive the session: wiped when the session ended without a network error
  // (expired, revoked elsewhere, signed out) -- an offline start (session fetch failed) keeps it, that is its purpose.
  useEffect(() => {
    if (!isPending && !session && !sessionError) {
      void clearAllCardCache();
      void clearOfflineCache();
      clearDocumentFileCache();
    }
  }, [isPending, session, sessionError]);

  // Downloaded documents of a session that was killed before its screen closed.
  useEffect(() => {
    clearDocumentFileCache();
  }, []);

  const signOut = useCallback(async () => {
    // Needs the still-valid session; best effort and time-boxed, never blocks the logout.
    try {
      void clearAllCardCache();
      void clearOfflineCache();
      await unregisterPushToken();
      await authClient.signOut();
      setTwoFactorPending(false);
    } finally {
      // If the sign-out itself failed the account stays signed in and may register push again.
      resumePushRegistration();
    }
  }, []);

  const deleteAccount = useCallback(async (password: string): Promise<AuthResult> => {
    // The token is removed while the session still exists; a wrong password re-registers it on the next sync.
    await unregisterPushToken();
    const { error } = await authClient.deleteUser({ password });

    if (error) {
      resumePushRegistration();
      return { ...failure(error, 'Unable to delete account.') };
    }

    void clearAllCardCache();
    void clearOfflineCache();
    clearDocumentFileCache();
    scheduleSessionRefetch();
    return { success: true };
  }, [scheduleSessionRefetch]);

  const updateProfile = useCallback(async (name: string): Promise<AuthResult> => {
    const { error } = await authClient.updateUser({ name });

    if (error) {
      return { ...failure(error, 'Unable to update profile.') };
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
        return { ...failure(error, 'Unable to change password.') };
      }

      return { success: true };
    },
    [],
  );

  const listSessions = useCallback(async (): Promise<ListSessionsResult> => {
    const { data, error } = await authClient.listSessions();

    if (error) {
      return { ...failure(error, 'Unable to load sessions.'), sessions: [] };
    }

    return { success: true, sessions: data ?? [] };
  }, []);

  const revokeSession = useCallback(async (token: string): Promise<AuthResult> => {
    const { error } = await authClient.revokeSession({ token });

    if (error) {
      return { ...failure(error, 'Unable to revoke session.') };
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
      return { ...failure(error, 'Unable to enable two-factor authentication.') };
    }

    // `data` is a discriminated union ({ method: "otp" } | { method: "totp"; totpURI; backupCodes })
    // because the plugin also supports email-OTP as a second factor -- this
    // backend only configures TOTP, so the "otp" branch never actually comes
    // back, but the type doesn't know that.
    return { success: true, totpUri: data?.method === 'totp' ? data.totpURI : undefined };
  }, []);

  const disableTwoFactor = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await authClient.twoFactor.disable({ password });

    if (error) {
      return { ...failure(error, 'Unable to disable two-factor authentication.') };
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
