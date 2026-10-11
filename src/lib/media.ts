import { File, Paths, UploadType } from 'expo-file-system';

import { authClient, backendUrl } from '@/auth/auth-client';
import { ApiError, apiErrorFromResponse } from '@/lib/api';
import { sanitizeMediaFilename } from '@/lib/mediaKey';

/**
 * Authenticated upload helpers for this backend's media layer (see
 * myverein-backend's `src/routes/media.ts`, Wave 7 B18). Uploads go to the
 * club-scoped `POST /media?clubId=` and return a storage `key` that feature
 * requests carry as `photoKey`. There is no download helper on purpose:
 * `GET /media/<key>` is only reachable with a short-lived signed URL that a
 * feature route hands out in its response (`photoUrl`), which a plain
 * `<Image source={{ uri }}>` loads without cookies. Keys/URLs are never
 * persisted client-side.
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

/** True if `uri` lies inside the app's cache directory (picker/manipulator output, safe to delete after use). */
export function isInAppCache(uri: string): boolean {
  try {
    return uri.startsWith(Paths.cache.uri);
  } catch {
    return false;
  }
}

// Without a bound, a stalled/dropped connection (or the app backgrounded
// mid-transfer) leaves the upload/download promise pending forever -- the
// caller's loading state never resolves and there's no way to retry.
const TRANSFER_TIMEOUT_MS = 30_000;

// `File.upload()` is a native request, not `authClient.$fetch` -- the
// session cookie isn't attached automatically, so it's read from the same
// store the `expoClient` plugin uses and set explicitly. Cast: the plugin's
// action types don't merge into `authClient`'s type even though the method
// exists at runtime (same pre-existing gap as elsewhere in this app).
async function getSessionCookie(): Promise<string> {
  return (authClient as unknown as { getCookie: () => Promise<string> }).getCookie();
}

/** Backend limit for generic image uploads (`MAX_IMAGE_BYTES`); checked client-side first to spare the upload. */
export const MAX_MEDIA_IMAGE_BYTES = 10 * 1024 * 1024;
/** Image types `POST /media` accepts. */
export const MEDIA_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadedMedia {
  /** Storage key (`<clubId>/<uuid>.<ext>`) -- pass as `photoKey` to the feature route. */
  key: string;
  /** Short-lived signed preview URL; for immediate preview only, never store it. */
  url: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Uploads an image asset (e.g. from `expo-image-picker`) to
 * `POST /media?clubId=` (multipart `file`, JPEG/PNG/WebP, up to 10 MB). On
 * success returns `{ media }`; failures come back as an `ApiError` (so
 * `apiErrorMessage` maps `QUOTA_EXCEEDED`, 422 etc.) or a plain `Error` for
 * local problems.
 */
export async function uploadMedia(
  clubId: string,
  asset: { uri: string; name: string; type: string; fileSize?: number | null },
): Promise<{ media: UploadedMedia } | { error: unknown }> {
  if (!MEDIA_IMAGE_TYPES.includes(asset.type)) return { error: new ApiError(422, 'VALIDATION_ERROR', 'Unsupported file type') };
  if (asset.fileSize != null && asset.fileSize > MAX_MEDIA_IMAGE_BYTES) {
    return { error: new ApiError(422, 'VALIDATION_ERROR', 'File too large') };
  }
  // toUploadableFile throws synchronously (not a rejected promise) on failure.
  let file: File;
  try {
    file = toUploadableFile(asset.uri, asset.name);
  } catch (err) {
    return { error: err };
  }
  // Delete the file afterwards if it is a copy made here or the picker's output in the app cache -- never a user original.
  const isTempCopy = !asset.uri.startsWith('file://') || isInAppCache(asset.uri);
  try {
    const cookie = await getSessionCookie();
    const result = await file.upload(`${backendUrl}/media?clubId=${encodeURIComponent(clubId)}`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: asset.type,
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
    });
    if (result.status < 200 || result.status >= 300) return { error: apiErrorFromResponse(result.status, result.body) };
    let media: UploadedMedia | undefined;
    try {
      media = (result.body ? JSON.parse(result.body) : null)?.data;
    } catch {
      media = undefined;
    }
    if (!media?.key) return { error: apiErrorFromResponse(500, null) };
    return { media };
  } catch (err) {
    return { error: err };
  } finally {
    if (isTempCopy) {
      try {
        file.delete();
      } catch {
        // best-effort cache cleanup
      }
    }
  }
}

/**
 * Uploads one proof document for a club registration to
 * `POST /club-registrations/:id/documents` (multipart: `file` + `kind`).
 * Unlike `uploadMedia` this route is NOT club-scoped (the applicant has no
 * club yet), so there is no `clubId`; the backend stores the file privately
 * and returns the document metadata (`{ data: { document } }`).
 */
export async function uploadRegistrationDocument<TDocument>(
  registrationId: string,
  kind: string,
  asset: { uri: string; name: string; type: string },
): Promise<{ document: TDocument } | { error: string; status?: number }> {
  let file: File;
  try {
    file = toUploadableFile(asset.uri, asset.name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to prepare file for upload' };
  }

  // Only the content:// copy in the cache is ours to delete -- never the
  // user's original file:// asset.
  const isTempCopy = !asset.uri.startsWith('file://');
  try {
    const cookie = await getSessionCookie();
    const result = await file.upload(`${backendUrl}/club-registrations/${registrationId}/documents`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: asset.type,
      parameters: { kind },
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
    });

    let parsed: { data?: { document?: TDocument }; error?: { message?: string } } | null = null;
    try {
      parsed = result.body ? JSON.parse(result.body) : null;
    } catch {
      parsed = null;
    }
    if (result.status < 200 || result.status >= 300) {
      return { error: parsed?.error?.message ?? 'Request failed', status: result.status };
    }
    const document = parsed?.data?.document;
    if (!document) return { error: 'Request failed' };
    return { document };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Request failed' };
  } finally {
    if (isTempCopy) {
      try {
        file.delete();
      } catch {
        // best-effort cache cleanup
      }
    }
  }
}

/** Backend limit for profile photos (`MAX_PHOTO_BYTES`); checked client-side first to spare the upload. */
export const MAX_MEMBER_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a profile photo: `PUT /club-members/me/photo` (`target = 'me'`) or
 * `PUT /club-members/:id/photo` (board, `members:write`), multipart field
 * `file`, JPEG/PNG/WebP, 5 MB. The backend returns the updated member shape
 * (incl. a fresh signed `photoUrl`), which is returned untouched; nothing is
 * persisted client-side. Failures come back as an `ApiError` (so
 * `apiErrorMessage` and status checks, e.g. 403 = minor, work as elsewhere)
 * or a plain `Error` for local problems.
 */
export async function uploadMemberPhoto<TMember>(
  clubId: string,
  target: 'me' | string,
  asset: { uri: string; name: string; type: string; fileSize?: number | null },
): Promise<{ member: TMember } | { error: unknown }> {
  if (asset.fileSize != null && asset.fileSize > MAX_MEMBER_PHOTO_BYTES) {
    return { error: new ApiError(422, 'VALIDATION_ERROR', 'File too large') };
  }
  let file: File;
  try {
    file = toUploadableFile(asset.uri, asset.name);
  } catch (err) {
    return { error: err };
  }
  // Delete the file afterwards if it is a copy made here or the picker's output in the app cache -- never a user original.
  const isTempCopy = !asset.uri.startsWith('file://') || isInAppCache(asset.uri);
  try {
    const cookie = await getSessionCookie();
    const result = await file.upload(`${backendUrl}/club-members/${encodeURIComponent(target)}/photo?clubId=${encodeURIComponent(clubId)}`, {
      httpMethod: 'PUT',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: asset.type,
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
    });
    if (result.status < 200 || result.status >= 300) return { error: apiErrorFromResponse(result.status, result.body) };
    let member: TMember | undefined;
    try {
      member = (result.body ? JSON.parse(result.body) : null)?.data;
    } catch {
      member = undefined;
    }
    if (!member) return { error: apiErrorFromResponse(500, null) };
    return { member };
  } catch (err) {
    return { error: err };
  } finally {
    if (isTempCopy) {
      try {
        file.delete();
      } catch {
        // best-effort cache cleanup
      }
    }
  }
}
