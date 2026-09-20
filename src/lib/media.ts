import { File, Paths, UploadType } from 'expo-file-system';

import { authClient, backendUrl } from '@/auth/auth-client';
import { sanitizeMediaFilename } from '@/lib/mediaKey';

/**
 * Authenticated upload/download helpers for this backend's `/media` route
 * (see myverein-backend's `src/routes/media.ts`). Adapted from
 * mycouple-mobile's `src/api/client.ts` (`mediaApi`/`toUploadableFile`), but
 * this backend's contract differs in three ways that matter here:
 *  - every route (including `/media`) is club-scoped via `clubGuard`, so
 *    both the upload and the download URL need `?clubId=`.
 *  - the upload response is `{ data: { key } }` -- no `url`/`sizeBytes`.
 *  - `GET /media/:key` is NOT public (session + club-id-prefix check), so a
 *    plain `<Image source={{ uri }}>` can't load it directly -- React
 *    Native's native image loader doesn't share the JS-side cookie jar
 *    `authClient` uses. `downloadMediaUri` fetches the bytes with the
 *    session cookie attached and writes them to a local cache file instead,
 *    returning a `file://` URI that `<Image>` can load like any other.
 */

// On Android, `expo-image-picker` can return a `content://` URI (its Photo
// Picker) instead of `file://`. Streaming a content:// URI straight into a
// multipart body hangs indefinitely -- RN's networking layer can't resolve
// the content stream's length upfront. Copying it to a real app-owned file
// first (a native copy, not JS-bridge streaming) avoids that; it's a no-op
// cost for URIs that are already `file://`.
function toUploadableFile(uri: string, name: string): File {
  if (uri.startsWith('file://')) return new File(uri);
  const dest = new File(Paths.cache, `${Date.now()}-${sanitizeMediaFilename(name)}`);
  new File(uri).copy(dest);
  return dest;
}

// `File.upload()` is a native request, not `authClient.$fetch` -- the
// session cookie isn't attached automatically, so it's read from the same
// store the `expoClient` plugin uses and set explicitly. Cast: the plugin's
// action types don't merge into `authClient`'s type even though the method
// exists at runtime (same pre-existing gap as elsewhere in this app).
async function getSessionCookie(): Promise<string> {
  return (authClient as unknown as { getCookie: () => Promise<string> }).getCookie();
}

/**
 * Uploads an image asset (e.g. from `expo-image-picker`) to
 * `POST /media?clubId=`. Returns the media key on success -- already
 * prefixed with `<clubId>/...`, pass it straight through as `photoKey` to
 * `POST /inventory-items/:id/damage-reports`.
 */
export async function uploadMedia(
  clubId: string,
  asset: { uri: string; name: string; type: string },
): Promise<{ key: string } | { error: string }> {
  // toUploadableFile throws synchronously (not a rejected promise) on
  // failure -- without this catch, that exception skips past the caller's
  // `await uploadMedia(...)` as an unhandled rejection instead of the
  // `{ error }` shape it checks for.
  let file: File;
  try {
    file = toUploadableFile(asset.uri, asset.name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to prepare file for upload' };
  }

  try {
    const cookie = await getSessionCookie();
    const result = await file.upload(`${backendUrl}/media?clubId=${clubId}`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: asset.type,
      headers: { Cookie: cookie },
    });

    const parsed: { data?: { key?: string }; error?: { message?: string } } | null = result.body ? JSON.parse(result.body) : null;
    if (result.status < 200 || result.status >= 300) {
      // This backend's error envelope: `{ error: { code, message, details } }`.
      return { error: parsed?.error?.message ?? 'Request failed' };
    }
    const key = parsed?.data?.key;
    if (!key) return { error: 'Request failed' };
    return { key };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Request failed' };
  }
}

/**
 * Fetches `GET /media/:key?clubId=` with the session cookie attached and
 * writes the bytes to a cache file, returning its `file://` URI for use in
 * `<Image source={{ uri }}>`. Plain global `fetch` (not `authClient.$fetch`)
 * -- this just needs the raw bytes, not JSON parsing. Returns `null` on any
 * non-2xx response (404 = no photo, this is not an error condition) or
 * network failure -- callers render "no photo" rather than an error state.
 */
export async function downloadMediaUri(clubId: string, key: string): Promise<string | null> {
  try {
    const cookie = await getSessionCookie();
    const response = await fetch(`${backendUrl}/media/${key}?clubId=${clubId}`, { headers: { Cookie: cookie } });
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const filename = sanitizeMediaFilename(key.split('/').pop() ?? 'media');
    const destination = new File(Paths.cache, `${Date.now()}-${filename}`);
    if (destination.exists) destination.delete();
    destination.write(bytes);
    return destination.uri;
  } catch {
    return null;
  }
}
