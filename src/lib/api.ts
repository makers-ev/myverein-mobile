import { authClient, backendUrl } from '@/auth/auth-client';

/** Mirrors the backend's `AppError`/`ErrorCode` shape (src/lib/errors.ts). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/**
 * Typed wrapper around `authClient.$fetch` -- see README.md's "Adding a new
 * API request" for the full recipe this implements. Callers pass a bare
 * path (`/notifications`); this is the one place that prepends `backendUrl`,
 * since `authClient.$fetch` resolves a relative path against Better Auth's
 * own `/api/auth` base, not the backend root.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { data, error } = await authClient.$fetch<T>(`${backendUrl}${path}`, {
    method: options.method ?? 'GET',
    body: options.body,
  });

  if (error) {
    // The backend answers `{ error: { code, message, details } }`; better-fetch spreads that body into `error`.
    // Older flat shapes (`{ code, message }`) keep working.
    const flat = error as { code?: string; message?: string; details?: unknown; error?: { code?: string; message?: string; details?: unknown } };
    const body = flat.error && typeof flat.error === 'object' ? flat.error : flat;
    throw new ApiError(
      error.status,
      body.code ?? flat.code ?? 'UNKNOWN',
      body.message ?? error.message ?? 'Request failed',
      body.details ?? flat.details,
    );
  }

  return data as T;
}
