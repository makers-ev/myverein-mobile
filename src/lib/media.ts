import { Directory, File, Paths, UploadType } from 'expo-file-system';

import { authClient, backendUrl } from '@/auth/auth-client';
import { ApiError, apiErrorFromResponse } from '@/lib/api';
import { isReviewFilePath } from '@/lib/applicationReview';
import { progressPercent } from '@/lib/formSchema';
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

/**
 * No client-side type whitelist: the backend decides (magic bytes). Only fixes up what pickers report badly --
 * an empty type or `image/jpg` -- so the multipart part carries a sensible content type.
 */
export function normalizeImageMime(type: string | null | undefined, name: string): string {
  const t = (type ?? '').toLowerCase();
  if (t === 'image/jpg') return 'image/jpeg';
  if (t) return t;
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return `image/${ext}`;
  return 'image/jpeg';
}

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
      mimeType: normalizeImageMime(asset.type, asset.name),
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

/**
 * Uploads one photo of a form draft to `POST /form-submissions/:id/files` (multipart `file` + `fieldKey`; the backend
 * checks magic bytes, the type allowed for the field, size, quota and rate limit and registers the file in the media
 * layer -- no URL or key is kept here). Not club-scoped (the applicant has no club yet). Success returns the file DTO
 * (`{ data: { file } }`, a signed preview `url` for non-sensitive images -- memory only, never stored); failures come
 * back as an `ApiError` or a plain `Error` for local problems / aborts. `signal` cancels the transfer, `onProgress`
 * reports 0..100 (null = unknown). The picker's cache copy is deleted afterwards.
 */
export async function uploadSubmissionFile<TFile>(
  submissionId: string,
  fieldKey: string,
  asset: { uri: string; name: string; type: string; fileSize?: number | null },
  options: { signal?: AbortSignal; onProgress?: (percent: number | null) => void } = {},
): Promise<{ file: TFile } | { error: unknown }> {
  let file: File;
  try {
    file = toUploadableFile(asset.uri, asset.name);
  } catch (err) {
    return { error: err };
  }
  // Delete the file afterwards if it is a copy made here or the picker's output in the app cache -- never a user original.
  const isTempCopy = !asset.uri.startsWith('file://') || isInAppCache(asset.uri);
  // A caller abort and the transfer timeout both end the request through one controller.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', forwardAbort, { once: true });
  try {
    const cookie = await getSessionCookie();
    const result = await file.upload(`${backendUrl}/form-submissions/${encodeURIComponent(submissionId)}/files`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: normalizeImageMime(asset.type, asset.name),
      parameters: { fieldKey },
      headers: { Cookie: cookie },
      signal: controller.signal,
      onProgress: options.onProgress ? (p) => options.onProgress?.(progressPercent(p.bytesSent, p.totalBytes)) : undefined,
    });
    if (result.status < 200 || result.status >= 300) return { error: apiErrorFromResponse(result.status, result.body) };
    let uploaded: TFile | undefined;
    try {
      uploaded = (result.body ? JSON.parse(result.body) : null)?.data?.file;
    } catch {
      uploaded = undefined;
    }
    if (!uploaded) return { error: apiErrorFromResponse(500, null) };
    return { file: uploaded };
  } catch (err) {
    return { error: err };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
    if (isTempCopy) {
      try {
        file.delete();
      } catch {
        // best-effort cache cleanup
      }
    }
  }
}

const REVIEW_CACHE_DIR = 'review-files';
let reviewFileCounter = 0;

/**
 * Deletes every file `downloadReviewImage` left in the app cache (called when the review screen opens and closes, so a
 * crashed or killed session cannot leave applicant photos behind).
 */
export function clearReviewFileCache(): void {
  try {
    const dir = new Directory(Paths.cache, REVIEW_CACHE_DIR);
    if (dir.exists) dir.delete();
  } catch {
    // best-effort cache cleanup
  }
}

/**
 * Authenticated download of an application's image file for the board (`GET /form-submissions/:id/files/:fileId` with the
 * session cookie; the backend checks `members:write`, redacts protected files and audits every retrieval). `path` must be
 * the review file path from `GET /club-applications/:id` -- anything else is refused before a request is made, so the
 * cookie never leaves the backend's file route. The bytes go to a private file in the app cache (`review-files/`); the
 * caller shows it and calls `remove()` as soon as it is hidden or the detail closes. No URL or key is stored. Failures come
 * back as an `ApiError` (status parsed from the native error) or a plain `Error` (abort, local problem).
 */
export async function downloadReviewImage(
  path: string,
  signal?: AbortSignal,
): Promise<{ uri: string; remove: () => void } | { error: unknown }> {
  if (!isReviewFilePath(path)) return { error: new ApiError(404, 'NOT_FOUND', 'Not a review file path') };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });
  let dest: File | null = null;
  try {
    const dir = new Directory(Paths.cache, REVIEW_CACHE_DIR);
    dir.create({ idempotent: true, intermediates: true });
    dest = new File(dir, `${Date.now()}-${++reviewFileCounter}.img`);
    const cookie = await getSessionCookie();
    const downloaded = await File.downloadFileAsync(`${backendUrl}${path}`, dest, {
      headers: { Cookie: cookie },
      idempotent: true,
      signal: controller.signal,
    });
    const target = downloaded;
    return {
      uri: target.uri,
      remove: () => {
        try {
          target.delete();
        } catch {
          // best-effort cache cleanup
        }
      },
    };
  } catch (err) {
    try {
      // A failed Android download can leave a partial file behind.
      if (dest?.exists) dest.delete();
    } catch {
      // best-effort cache cleanup
    }
    if (!controller.signal.aborted && err instanceof Error) {
      // expo-file-system reports a non-2xx answer as `UnableToDownload` with the status code in the message.
      const status = /\b([45]\d{2})\b/.exec(err.message)?.[1];
      if (status) return { error: new ApiError(Number(status), 'UNKNOWN', 'Download failed') };
    }
    return { error: err };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
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
