// Pure helpers for "Bestätigungen" (Wave 13 M5): a simple electronic confirmation that a person read a document version.

export type AcknowledgementStatus = 'offen' | 'bestaetigt' | 'abgelehnt' | 'abgelaufen';

/** One row of `GET /acknowledgements/mine`; names and titles are personal data and never logged. */
export interface MyAcknowledgement {
  id: string;
  documentTitle: string;
  versionNo: number;
  clubMemberId: string;
  personName: string;
  relation: 'self' | 'guardian';
  status: AcknowledgementStatus;
  wording: string;
  requestedAt: string;
  dueAt: string | null;
  respondedAt: string | null;
  requiresReauth: boolean;
  canAnswer: boolean;
  isCurrentVersion: boolean;
}

/** `GET /acknowledgements/:id` (members see their own request; `documentId` is for managers only and unused here). */
export interface AcknowledgementDetail extends Omit<MyAcknowledgement, 'documentTitle'> {
  documentTitle?: string;
  mimeType?: string | null;
  givenBy?: 'self' | 'guardian' | 'board_paper' | null;
}

const time = (value: string | null): number => (value ? Date.parse(value) || 0 : 0);

/** Open requests (earliest deadline first, no deadline last) and everything answered or expired (newest first). */
export function splitAcknowledgements(list: MyAcknowledgement[]): { open: MyAcknowledgement[]; done: MyAcknowledgement[] } {
  const open = list
    .filter((a) => a.status === 'offen')
    .sort((a, b) => (a.dueAt ? time(a.dueAt) : Number.MAX_SAFE_INTEGER) - (b.dueAt ? time(b.dueAt) : Number.MAX_SAFE_INTEGER) || time(a.requestedAt) - time(b.requestedAt));
  const done = list.filter((a) => a.status !== 'offen').sort((a, b) => time(b.respondedAt ?? b.requestedAt) - time(a.respondedAt ?? a.requestedAt));
  return { open, done };
}

/** Only an open request that the backend marks as answerable can be answered (a minor with an account only reads). */
export const canAnswerNow = (a: Pick<MyAcknowledgement, 'status' | 'canAnswer'>): boolean => a.status === 'offen' && a.canAnswer;

export type AckErrorCode = 'already_answered' | 'expired' | 'member_left' | 'guardian_required' | 'reauth_required' | 'reauth_failed';

export function ackErrorCode(err: unknown): AckErrorCode | null {
  const code = (err as { details?: { code?: unknown } } | null)?.details?.code;
  switch (code) {
    case 'already_answered':
    case 'expired':
    case 'member_left':
    case 'guardian_required':
    case 'reauth_required':
    case 'reauth_failed':
      return code;
    default:
      return null;
  }
}

/** Translation key for a failed confirmation; `null` = generic text. The error never carries user text into the UI. */
export function ackErrorKey(err: unknown): string | null {
  const code = ackErrorCode(err);
  return code ? `ack.error.${code}` : null;
}

/** A reload is needed after these: the server state differs from what the screen shows. */
export const ackNeedsReload = (err: unknown): boolean => {
  const code = ackErrorCode(err);
  return code === 'already_answered' || code === 'expired' || code === 'member_left' || code === 'guardian_required';
};
