// Pure, dependency-free helpers around media keys/filenames -- kept out of
// media.ts (imports `authClient`) and useInventory.ts (imports `apiFetch`,
// which imports `authClient`) specifically so they stay unit-testable
// without pulling in better-auth's ESM-only client, which this repo's Jest
// config doesn't transform (same convention as withScheme.ts/wifiQr.ts).

/**
 * expo-file-system's `File`/`Directory` API throws on paths containing
 * spaces, "#", or "%" (github.com/expo/expo#35619) -- all common in real
 * gallery filenames and in this backend's own `<uuid>-<filename>` media
 * keys.
 */
export function sanitizeMediaFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_');
}
