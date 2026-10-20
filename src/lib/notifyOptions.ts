/**
 * Helpers for the "notify members" switches of event and meeting author actions (Wave 9, gap 11).
 * The backend notifies by default; only an explicit `notify: false` suppresses, so the flag is
 * sent only when the switch is off (older backends and the default flow stay byte-identical).
 */

/** Adds `notify: false` to a request body when the switch is off, otherwise returns the body unchanged. */
export function withNotify<T extends object>(body: T, notify: boolean): T | (T & { notify: false }) {
  return notify ? body : { ...body, notify: false };
}

/** Appends `notify=false` to a DELETE path (`?notify=false`) when the switch is off. */
export function withNotifyQuery(path: string, notify: boolean): string {
  if (notify) return path;
  return `${path}${path.includes('?') ? '&' : '?'}notify=false`;
}

export const CANCEL_REASON_MAX = 500;

/** Body of `POST /events/:id/cancel`: trimmed optional reason (max 500), `notify: false` only when off. */
export function cancelBody(reason: string, notify: boolean): { reason?: string; notify?: false } {
  const trimmed = reason.trim().slice(0, CANCEL_REASON_MAX);
  return { ...(trimmed ? { reason: trimmed } : {}), ...(notify ? {} : { notify: false as const }) };
}

/** `GET /events/:id/cancel-preview` data: numbers only. */
export interface CancelPreview {
  alreadyCancelled: boolean;
  confirmed: number;
  waitlisted: number;
  departmentCalendar: boolean;
  audience: {
    total: number;
    reachable: number;
    inApp: number;
    email: number;
    emailOnly: number;
    unreachable: number;
    sharedAddress: number;
    tooLarge: boolean;
  };
}

export type CancelPreviewKind = 'already-cancelled' | 'too-large' | 'nobody' | 'some';

/** Which message the preview card shows; `tooLarge` means the backend would not send the cancellation at all. */
export function cancelPreviewKind(preview: CancelPreview): CancelPreviewKind {
  if (preview.alreadyCancelled) return 'already-cancelled';
  if (preview.audience.tooLarge) return 'too-large';
  if (preview.audience.total === 0) return 'nobody';
  return 'some';
}
