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

/** All reduced roles of an account (`externalOnly` guests only); sponsor first. Empty for everybody else (deny by default). */
export function externalRolesOf(me: Pick<ExternalMe, 'externalOnly' | 'roleTypes'> | null | undefined): ExternalRole[] {
  if (!me || me.externalOnly !== true) return [];
  return (['sponsor', 'dienstleister'] as const).filter((r) => me.roleTypes.includes(r));
}

/** The primary reduced role (a sponsor wins over a service provider; an account with both reaches both screens). */
export function externalRoleOf(me: Pick<ExternalMe, 'externalOnly' | 'roleTypes'> | null | undefined): ExternalRole | null {
  return externalRolesOf(me)[0] ?? null;
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

export interface ExternalAssignment {
  id: string;
  title: string;
  note: string | null;
  /** ISO timestamps. */
  validFrom: string;
  validUntil: string;
  /** The server's view: inside the window right now. */
  active: boolean;
  location: { id: string; name: string; address: string | null } | null;
}

/** `GET /external/me` (backend `routes/external-access.ts`): the whole reduced app of an external login. Own sponsor profile(s) never carry internal notes. */
export interface ExternalMe {
  clubId: string;
  clubName: string;
  clubSlug: string | null;
  externalOnly: boolean;
  roleTypes: string[];
  sponsors: Sponsor[];
  assignments: ExternalAssignment[];
}

/**
 * Parses the assignments. Place, address and note are kept ONLY while the window is open right now (`nowMs`, checked
 * locally whatever the server says); an assignment that has not started shows just title and window, one that is over is
 * dropped. The details of a later window therefore never enter the state; the screen reloads when a window opens.
 */
export function parseAssignments(list: unknown, nowMs: number = Date.now()): ExternalAssignment[] {
  if (!Array.isArray(list)) return [];
  const out: ExternalAssignment[] = [];
  for (const a of list as Record<string, unknown>[]) {
    if (!a || typeof a.id !== 'string' || typeof a.title !== 'string' || typeof a.validFrom !== 'string' || typeof a.validUntil !== 'string') continue;
    const phase = assignmentPhase({ validFrom: a.validFrom, validUntil: a.validUntil, active: a.active !== false }, nowMs);
    if (phase === 'over') continue;
    const loc = a.location && typeof a.location === 'object' ? (a.location as Record<string, unknown>) : null;
    const open = phase === 'active';
    out.push({
      id: a.id,
      title: a.title,
      note: open ? str(a.note) : null,
      validFrom: a.validFrom,
      validUntil: a.validUntil,
      active: a.active !== false,
      location: open && loc && typeof loc.id === 'string' && typeof loc.name === 'string' ? { id: loc.id, name: loc.name, address: str(loc.address) } : null,
    });
  }
  return out;
}

export function parseExternalMe(raw: unknown, nowMs: number = Date.now()): ExternalMe | null {
  const data = raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: unknown }).data : raw;
  if (!data || typeof data !== 'object') return null;
  const r = data as Record<string, unknown>;
  // `clubName` may be null on the wire (club row missing): the answer is still the role information, so it is not rejected.
  if (typeof r.clubId !== 'string') return null;
  return {
    clubId: r.clubId,
    clubName: typeof r.clubName === 'string' ? r.clubName : '',
    clubSlug: str(r.clubSlug),
    externalOnly: r.externalOnly === true,
    roleTypes: Array.isArray(r.roleTypes) ? r.roleTypes.filter((x): x is string => typeof x === 'string') : [],
    sponsors: Array.isArray(r.sponsors) ? r.sponsors.map(parseSponsor).filter((x): x is Sponsor => x !== null) : [],
    assignments: parseAssignments(r.assignments, nowMs),
  };
}

export type AssignmentPhase = 'active' | 'upcoming' | 'over';

/**
 * Where an assignment stands. The local clock ALWAYS decides whether the window is open (`[validFrom, validUntil]`): a stale
 * list or a server `active: true` never keeps access details after the end. A server `active: false` inside the local window
 * (clock skew) hides the details too (`over`, the conservative answer until the next reload).
 */
export function assignmentPhase(a: Pick<ExternalAssignment, 'validFrom' | 'validUntil'> & { active?: boolean }, nowMs: number): AssignmentPhase {
  const from = Date.parse(a.validFrom);
  const until = Date.parse(a.validUntil);
  if (Number.isNaN(from) || Number.isNaN(until)) return 'over';
  if (nowMs < from) return 'upcoming';
  if (nowMs > until) return 'over';
  return a.active === false ? 'over' : 'active';
}

/** The next moment (ms) a window opens or closes after `nowMs`, or null when none is ahead. Drives the screen timer. */
export function nextAssignmentBoundary(list: Pick<ExternalAssignment, 'validFrom' | 'validUntil'>[], nowMs: number): number | null {
  let next: number | null = null;
  for (const a of list) {
    for (const t of [Date.parse(a.validFrom), Date.parse(a.validUntil)]) {
      if (!Number.isNaN(t) && t >= nowMs && (next === null || t < next)) next = t;
    }
  }
  return next;
}

/** Public club page (`GET /public/clubs/:slug`, no session) as far as the sponsor view shows it. 404 = the club has no public page. */
export interface PublicClubInfo {
  name: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  /** Unsigned URL of a file the club released for the public page. */
  logoUrl: string | null;
  events: { title: string; startsAt: string; locationName: string | null }[];
}

export function parsePublicClub(raw: unknown): PublicClubInfo | null {
  const data = raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: unknown }).data : raw;
  if (!data || typeof data !== 'object') return null;
  const r = data as Record<string, unknown>;
  if (typeof r.name !== 'string') return null;
  const contact = r.contact && typeof r.contact === 'object' ? (r.contact as Record<string, unknown>) : {};
  const events: PublicClubInfo['events'] = [];
  if (Array.isArray(r.events)) {
    for (const e of r.events as Record<string, unknown>[]) {
      if (e && typeof e.title === 'string' && typeof e.startsAt === 'string' && e.cancelled !== true) events.push({ title: e.title, startsAt: e.startsAt, locationName: str(e.locationName) });
    }
  }
  return {
    name: r.name,
    tagline: str(r.tagline),
    description: str(r.description),
    city: str(r.city),
    address: str(r.address),
    contactEmail: str(contact.email),
    contactPhone: str(contact.phone),
    website: str(contact.website),
    logoUrl: str(r.logoUrl),
    events,
  };
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

/** The platform suspended the club (Wave 15 B7: `403 CLUB_SUSPENDED`, `details.code = club_suspended`): clients show an understandable notice, not a generic error. */
export function isClubSuspendedError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  const detail = String((err.details as { code?: unknown } | undefined)?.code ?? '').toLowerCase();
  return err.code.toLowerCase() === 'club_suspended' || detail === 'club_suspended';
}

// --- Display helpers --------------------------------------------------------------------------------------------------

/** The club's time zone: all instants are shown in it, whatever zone the device is in (same as the website). */
export const CLUB_TIME_ZONE = 'Europe/Berlin';

/** ISO instant as "21.11.2026, 14:30" in the app language and Berlin time; null when it is not a date. */
export function formatInstant(iso: string | null | undefined, language: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return `${d.toLocaleDateString(language, { timeZone: CLUB_TIME_ZONE })}, ${d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', timeZone: CLUB_TIME_ZONE })}`;
  } catch {
    return `${d.toLocaleDateString(language)}, ${d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}`;
  }
}

/** `mailto:` link only for a plain e-mail address (no header injection, no extra recipients); else null. */
export function safeMailto(email: string | null | undefined): string | null {
  return email && /^[^\s@<>"',;?&=]+@[^\s@<>"',;?&=]+\.[^\s@<>"',;?&=]+$/.test(email) ? `mailto:${email}` : null;
}

/** `tel:` link only for a phone number made of digits and usual separators; else null. */
export function safeTel(phone: string | null | undefined): string | null {
  if (!phone || !/^\+?[0-9 ()./-]{3,40}$/.test(phone)) return null;
  return `tel:${phone.replace(/[^+0-9]/g, '')}`;
}
