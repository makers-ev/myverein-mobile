import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

// Base URL of the auth-backend-template Hono server. Set via
// EXPO_PUBLIC_BACKEND_URL (see .env.example) -- Expo/Metro inlines
// EXPO_PUBLIC_* vars into the bundle at build time, no extra app.json/
// app.config wiring is required.
export const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

// Public URL of the website template, used as the verification email's
// callbackURL -- the link always opens in the system browser, never this app.
export const websiteUrl = process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'http://localhost:3001';

/**
 * The single Better Auth client instance for the app. Session storage and
 * cookie persistence are handled by the `expoClient` plugin, backed by
 * `expo-secure-store` -- this is the native, in-app equivalent of what the
 * old Keycloak template did with `react-native-keychain`, except Better
 * Auth owns the cookie/session lifecycle instead of us hand-rolling token
 * refresh logic.
 *
 * `twoFactorClient` mirrors the backend's `twoFactor()` plugin
 * (auth-backend-template/src/auth/auth.ts) so `signIn.email()` resolves
 * with `{ data: { twoFactorRedirect: true } }` instead of a session when a
 * user has 2FA enabled, and `authClient.twoFactor.verifyTotp()` becomes
 * available to complete the challenge.
 */
export const authClient = createAuthClient({
  baseURL: backendUrl,
  plugins: [
    expoClient({
      storagePrefix: '_template_better-auth-mobile',
      storage: SecureStore,
    }),
    twoFactorClient(),
  ],
});

export type AuthClient = typeof authClient;

/**
 * Plain reachability check against the backend's liveness probe (never
 * touches the DB, see auth-backend-template/src/routes/health.ts) -- used by
 * AppNavigator's connection-error fallback to tell "still checking" apart
 * from "confirmed unreachable" instead of spinning forever.
 */
export async function checkBackendHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${backendUrl}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
