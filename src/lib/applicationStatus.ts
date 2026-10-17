import type { MySubmission, OnBehalfOf } from '@/lib/formSchema';

/** Decided applications older than this are no longer listed (the list shows what is recent, not the whole history). */
export const DECIDED_MAX_AGE_DAYS = 90;
/** At most this many decided applications are shown per club. */
export const DECIDED_PER_CLUB = 3;

export type DecidedStatus = 'accepted' | 'rejected' | 'withdrawn';

export interface DecidedApplication {
  id: string;
  status: DecidedStatus;
  onBehalfOf: OnBehalfOf;
  club: MySubmission['club'];
  /** The board's message to the applicant (only ever the public `decisionNote`; internal notes are not sent by the backend). */
  decisionNote: string | null;
  /** When the application was decided or withdrawn (falls back to submit/create date). */
  date: string;
}

export interface OpenApplication {
  id: string;
  status: 'draft' | 'submitted';
  onBehalfOf: OnBehalfOf;
  club: MySubmission['club'];
  date: string;
}

const timeOf = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

const isApplication = (m: MySubmission): boolean => m.purpose === 'aufnahme';

/**
 * Splits `GET /form-submissions/mine` into what the applicant can continue (drafts, pending applications; newest first) and
 * what was decided recently (accepted/rejected/withdrawn; newest first, capped per club and by age).
 */
export function selectApplicationStatus(
  mine: readonly MySubmission[],
  now: number = Date.now(),
): { open: OpenApplication[]; decided: DecidedApplication[] } {
  const open: OpenApplication[] = [];
  const decided: DecidedApplication[] = [];
  const cutoff = now - DECIDED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  for (const m of mine) {
    if (!isApplication(m)) continue;
    if (m.status === 'draft' || m.status === 'submitted') {
      open.push({ id: m.id, status: m.status, onBehalfOf: m.onBehalfOf, club: m.club, date: m.status === 'submitted' ? (m.submittedAt ?? m.createdAt) : m.createdAt });
    } else if (m.status === 'accepted' || m.status === 'rejected' || m.status === 'withdrawn') {
      const date = m.decidedAt ?? m.submittedAt ?? m.createdAt;
      if (timeOf(date) < cutoff) continue;
      decided.push({ id: m.id, status: m.status, onBehalfOf: m.onBehalfOf, club: m.club, decisionNote: m.status === 'rejected' ? (m.decisionNote?.trim() || null) : null, date });
    }
  }
  open.sort((a, b) => timeOf(b.date) - timeOf(a.date));
  decided.sort((a, b) => timeOf(b.date) - timeOf(a.date));
  const perClub = new Map<string, number>();
  return {
    open,
    decided: decided.filter((d) => {
      const n = (perClub.get(d.club.slug) ?? 0) + 1;
      perClub.set(d.club.slug, n);
      return n <= DECIDED_PER_CLUB;
    }),
  };
}

/** The newest open draft of one club and applicant mode, if any (resume instead of starting a second one). */
export function findOpenDraft(mine: readonly MySubmission[], slug: string, mode: OnBehalfOf): MySubmission | undefined {
  return mine
    .filter((m) => isApplication(m) && m.status === 'draft' && m.club.slug === slug && m.onBehalfOf === mode)
    .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))[0];
}

/** Club codes are lower-case and trimmed; empty or not code-like input yields `null`. */
export function normalizeClubSlug(input: string | null | undefined): string | null {
  const value = (input ?? '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(value) ? value : null;
}

/** Date in the club's time zone (Europe/Berlin), e.g. `17.10.2026`; an unparseable value yields an empty string. */
export function formatBerlinDate(iso: string, language: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-GB', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
}
