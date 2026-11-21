import { unwrapList } from './envelope';
import { ApiError } from './api';
import { parseDayKey } from './ward';

/**
 * Wave 15 (Aussenwirkung): sponsors/partners (board list, read only), the reduced external roles `sponsor` and
 * `dienstleister`, and the club search for joining. Pure types and parsers; dates stay `YYYY-MM-DD` / ISO strings.
 * Nothing here is persisted. Server texts never reach the UI (error codes are mapped in `apiErrorMessage.ts`).
 */

// --- External roles ---------------------------------------------------------------------------------------------------

export type ExternalRole = 'sponsor' | 'dienstleister';

const EXTERNAL_ROLES: readonly string[] = ['sponsor', 'dienstleister'];

/**
 * The external role of a membership (`GET /my-clubs`): an explicit `externalRole`, else a `sponsor` / `dienstleister`
 * token in the (possibly comma-separated) `orgRole`. Deny by default: anything else is a normal member (null).
 */
export function externalRoleOf(club: { orgRole?: string | null; externalRole?: string | null } | null | undefined): ExternalRole | null {
  if (!club) return null;
  if (club.externalRole && EXTERNAL_ROLES.includes(club.externalRole)) return club.externalRole as ExternalRole;
  const token = (club.orgRole ?? '')
    .split(',')
    .map((r) => r.trim())
    .find((r) => EXTERNAL_ROLES.includes(r));
  return (token as ExternalRole | undefined) ?? null;
}

// --- Sponsors ---------------------------------------------------------------------------------------------------------

export type SponsorStatus = 'geplant' | 'aktiv' | 'abgelaufen';
export type SponsorVisibility = 'intern' | 'oeffentlich';

export interface SponsorContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface Sponsor {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  /** Free text: what the club gives in return. No amounts, billing is not part of MyVerein. */
  consideration: string | null;
  startsOn: string | null;
  endsOn: string | null;
  visibility: SponsorVisibility;
  status: SponsorStatus;
  expiringSoon: boolean;
  daysLeft: number | null;
  /** Short-lived signed URL from the media layer; render with `SignedImage`, never store. */
  logoUrl: string | null;
  contacts: SponsorContact[];
  /** Name of the linked external login, if the sponsor has one. */
  linkedAccountName: string | null;
}

const STATUSES: readonly SponsorStatus[] = ['geplant', 'aktiv', 'abgelaufen'];
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

function parseContacts(v: unknown): SponsorContact[] {
  if (!Array.isArray(v)) return [];
  const out: SponsorContact[] = [];
  for (const c of v as Record<string, unknown>[]) {
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') continue;
    out.push({ id: c.id, name: c.name, role: str(c.role), email: str(c.email), phone: str(c.phone), isPrimary: c.isPrimary === true });
  }
  return out;
}

export function parseSponsor(raw: unknown): Sponsor | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const status = STATUSES.includes(r.status as SponsorStatus) ? (r.status as SponsorStatus) : 'aktiv';
  const linked = r.linkedAccount && typeof r.linkedAccount === 'object' ? (r.linkedAccount as { name?: unknown }).name : null;
  return {
    id: r.id,
    name: r.name,
    website: str(r.website),
    description: str(r.description),
    consideration: str(r.consideration),
    startsOn: str(r.startsOn),
    endsOn: str(r.endsOn),
    visibility: r.visibility === 'oeffentlich' ? 'oeffentlich' : 'intern',
    status,
    expiringSoon: r.expiringSoon === true,
    daysLeft: typeof r.daysLeft === 'number' ? r.daysLeft : null,
    logoUrl: str(r.logoUrl),
    contacts: parseContacts(r.contacts),
    linkedAccountName: str(linked),
  };
}

/** Normalises a list answer (`{ data: [...] }` or bare array); entries without id/name are dropped, a malformed answer is `null`. */
export function parseSponsors(payload: unknown): Sponsor[] | null {
  const list = unwrapList<unknown>(payload);
  if (!list) return null;
  return list.map(parseSponsor).filter((s): s is Sponsor => s !== null);
}

export type SponsorGroup = 'expiring' | 'active' | 'planned' | 'expired';
export const SPONSOR_GROUP_ORDER: readonly SponsorGroup[] = ['expiring', 'active', 'planned', 'expired'];

export function sponsorGroup(s: Pick<Sponsor, 'status' | 'expiringSoon'>): SponsorGroup {
  if (s.status === 'abgelaufen') return 'expired';
  if (s.status === 'geplant') return 'planned';
  return s.expiringSoon ? 'expiring' : 'active';
}

/** Groups in display order, empty groups left out; the order inside a group is the server's (name). */
export function groupSponsors(list: Sponsor[]): { group: SponsorGroup; items: Sponsor[] }[] {
  return SPONSOR_GROUP_ORDER.map((group) => ({ group, items: list.filter((s) => sponsorGroup(s) === group) })).filter((g) => g.items.length > 0);
}

/** Board roles that may see the sponsor list (deny by default; the server decides again). */
export function canSeeSponsors(can: (p: 'sponsors:read' | 'sponsors:write') => boolean): boolean {
  return can('sponsors:read') || can('sponsors:write');
}

/** Only http(s) links are ever opened (the field is typed in by the board). */
export function safeWebLink(url: string | null | undefined): string | null {
  return url && /^https?:\/\/[^\s<>"]+$/i.test(url) ? url : null;
}

/** `YYYY-MM-DD` as a local date in the app language. */
export function formatDay(day: string | null | undefined, language: string): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return parseDayKey(day).toLocaleDateString(language);
}

// --- External accounts ------------------------------------------------------------------------------------------------

/** Own sponsor profile of a `sponsor` login: what the club recorded about the partnership (no internal notes). */
export interface ExternalSponsorProfile {
  name: string;
  website: string | null;
  description: string | null;
  consideration: string | null;
  startsOn: string | null;
  endsOn: string | null;
  status: SponsorStatus;
  daysLeft: number | null;
  logoUrl: string | null;
}

/** Public club information an external role may read (never member data). */
export interface ExternalClubInfo {
  name: string;
  description: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  city: string | null;
}

export interface ExternalAssignment {
  id: string;
  title: string;
  note: string | null;
  /** ISO timestamps. */
  validFrom: string;
  validUntil: string;
  location: { id: string; name: string; address: string | null; accessNote: string | null } | null;
}

export function parseExternalSponsorProfile(raw: unknown): ExternalSponsorProfile | null {
  const s = parseSponsor(raw);
  if (!s) return null;
  return { name: s.name, website: s.website, description: s.description, consideration: s.consideration, startsOn: s.startsOn, endsOn: s.endsOn, status: s.status, daysLeft: s.daysLeft, logoUrl: s.logoUrl };
}

export function parseExternalClubInfo(raw: unknown): ExternalClubInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string') return null;
  return { name: r.name, description: str(r.description), logoUrl: str(r.logoUrl), contactEmail: str(r.contactEmail), contactPhone: str(r.contactPhone), website: str(r.website), city: str(r.city) };
}

export function parseAssignments(payload: unknown): ExternalAssignment[] | null {
  const list = unwrapList<Record<string, unknown>>(payload);
  if (!list) return null;
  const out: ExternalAssignment[] = [];
  for (const a of list) {
    if (!a || typeof a.id !== 'string' || typeof a.title !== 'string' || typeof a.validFrom !== 'string' || typeof a.validUntil !== 'string') continue;
    const loc = a.location && typeof a.location === 'object' ? (a.location as Record<string, unknown>) : null;
    out.push({
      id: a.id,
      title: a.title,
      note: str(a.note),
      validFrom: a.validFrom,
      validUntil: a.validUntil,
      location: loc && typeof loc.id === 'string' && typeof loc.name === 'string' ? { id: loc.id, name: loc.name, address: str(loc.address), accessNote: str(loc.accessNote) } : null,
    });
  }
  return out;
}

export type AssignmentPhase = 'active' | 'upcoming' | 'over';

/** Where `now` lies relative to the window. Access details are only shown while `active` (the server enforces it too). */
export function assignmentPhase(a: Pick<ExternalAssignment, 'validFrom' | 'validUntil'>, nowMs: number): AssignmentPhase {
  const from = Date.parse(a.validFrom);
  const until = Date.parse(a.validUntil);
  if (Number.isNaN(from) || Number.isNaN(until)) return 'over';
  if (nowMs < from) return 'upcoming';
  if (nowMs > until) return 'over';
  return 'active';
}

// --- Club search ------------------------------------------------------------------------------------------------------

/** Searching starts from this many characters (the server enforces a minimum too: `query_too_short`). */
export const MIN_CLUB_SEARCH_LENGTH = 3;

export interface ClubSearchHit {
  slug: string;
  name: string;
  city: string | null;
  /** Signed, short-lived logo URL (media layer), optional. */
  logoUrl: string | null;
}

export function normalizeSearchQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ');
}

export function canSearchClubs(q: string): boolean {
  return normalizeSearchQuery(q).length >= MIN_CLUB_SEARCH_LENGTH;
}

export function parseClubHits(payload: unknown): ClubSearchHit[] | null {
  const list = unwrapList<Record<string, unknown>>(payload);
  if (!list) return null;
  const out: ClubSearchHit[] = [];
  for (const h of list) {
    if (!h || typeof h.slug !== 'string' || typeof h.name !== 'string' || h.slug === '') continue;
    out.push({ slug: h.slug, name: h.name, city: str(h.city), logoUrl: str(h.logoUrl) });
  }
  return out;
}

/** The platform suspended the club (Wave 15 B7): clients show an understandable notice, not a generic error. */
export function isClubSuspendedError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  const code = err.code.toLowerCase();
  const detail = String((err.details as { code?: unknown } | undefined)?.code ?? '').toLowerCase();
  return code === 'club_suspended' || detail === 'club_suspended';
}
