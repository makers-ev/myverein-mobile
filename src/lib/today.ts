/** `GET /clubs/:clubId/today` (Wave 14 N2): everything a member should see first, in one call. */
export interface TodayEvent {
  eventId: string;
  title: string;
  startsAt: string;
}

export interface TodayLoan {
  loanId: string;
  itemName: string;
  dueAt: string;
}

export interface TodayBoard {
  openApplications?: number;
  openExits?: number;
  maintenanceDue?: number;
  memberCount?: number;
}

export interface TodaySetup {
  done: string[];
  open: string[];
}

export interface Today {
  generatedAt: string;
  openRsvps: TodayEvent[];
  cancelled: TodayEvent[];
  unreadAnnouncements: number;
  dueReturns: TodayLoan[];
  openBallots: number;
  board: TodayBoard | null;
  setup: TodaySetup | null;
}

const asArray = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
const asCount = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';
const isEvent = (x: unknown): x is TodayEvent => isObj(x) && typeof x.eventId === 'string' && typeof x.startsAt === 'string';
const isLoan = (x: unknown): x is TodayLoan => isObj(x) && typeof x.loanId === 'string' && typeof x.dueAt === 'string';
const optCount = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : undefined);

/** Tolerant reader: missing or malformed parts become empty, `board`/`setup` stay `null` unless the server sent them (deny by default). */
export function parseToday(raw: unknown): Today {
  const body = isObj(raw) && isObj(raw.data) && !('openRsvps' in raw) ? raw.data : raw;
  const o = isObj(body) ? body : {};
  const board = isObj(o.board)
    ? {
        openApplications: optCount(o.board.openApplications),
        openExits: optCount(o.board.openExits),
        maintenanceDue: optCount(o.board.maintenanceDue),
        memberCount: optCount(o.board.memberCount),
      }
    : null;
  const setup =
    isObj(o.setup) && Array.isArray(o.setup.open) && o.setup.open.length > 0
      ? { done: asArray(o.setup.done, (x): x is string => typeof x === 'string'), open: asArray(o.setup.open, (x): x is string => typeof x === 'string') }
      : null;
  return {
    generatedAt: typeof o.generatedAt === 'string' ? o.generatedAt : new Date().toISOString(),
    openRsvps: asArray(o.openRsvps, isEvent),
    cancelled: asArray(o.cancelled, isEvent),
    unreadAnnouncements: asCount(o.unreadAnnouncements),
    dueReturns: asArray(o.dueReturns, isLoan),
    openBallots: asCount(o.openBallots),
    board,
    setup,
  };
}

/** True when nothing needs the person's attention (drives the calm "all done" empty state). */
export function isTodayEmpty(today: Today): boolean {
  const b = today.board;
  const boardTodo = !!b && ((b.openApplications ?? 0) > 0 || (b.openExits ?? 0) > 0 || (b.maintenanceDue ?? 0) > 0);
  return (
    today.openRsvps.length === 0 &&
    today.cancelled.length === 0 &&
    today.unreadAnnouncements === 0 &&
    today.dueReturns.length === 0 &&
    today.openBallots === 0 &&
    !boardTodo
  );
}

/** Setup step keys in display order (backend sends `done` / `open` subsets of these). */
export const SETUP_STEPS = ['logo', 'departments', 'calendar', 'location', 'members'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Where each setup step is done in the app; steps that are web-only point to `null` (the checklist then says so). */
export function setupStepTarget(step: string): { route: 'Verein' | 'Kalender' | 'Standorte'; tab?: string } | null {
  switch (step) {
    case 'calendar':
      return { route: 'Kalender', tab: 'termine' };
    case 'location':
      return { route: 'Standorte', tab: 'orte' };
    case 'members':
      return { route: 'Verein', tab: 'mitglieder' };
    default:
      return null;
  }
}

export interface SearchResults {
  members?: { id: string; name: string; departmentNames?: string[] }[];
  events: { id: string; title: string; startsAt: string }[];
  documents: { id: string; title: string; folderId: string | null }[];
  locations: { id: string; name: string }[];
}

export function parseSearch(raw: unknown): SearchResults {
  const body = isObj(raw) && isObj(raw.data) && !('events' in raw) ? raw.data : raw;
  const o = isObj(body) ? body : {};
  const list = <T,>(v: unknown, ok: (x: Record<string, unknown>) => boolean): T[] => (Array.isArray(v) ? (v.filter((x) => isObj(x) && ok(x)) as T[]) : []);
  const res: SearchResults = {
    events: list(o.events, (x) => typeof x.id === 'string' && typeof x.title === 'string'),
    documents: list(o.documents, (x) => typeof x.id === 'string' && typeof x.title === 'string'),
    locations: list(o.locations, (x) => typeof x.id === 'string' && typeof x.name === 'string'),
  };
  if (Array.isArray(o.members)) res.members = list(o.members, (x) => typeof x.id === 'string' && typeof x.name === 'string');
  return res;
}

export const SEARCH_MIN_CHARS = 2;
