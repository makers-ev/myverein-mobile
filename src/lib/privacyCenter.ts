/** Pure helpers for the "Mein Datenschutz" screen (Wave 10 M4). Nothing here reads or logs personal text. */

export type VisibilityField = 'phone' | 'email' | 'address' | 'photo';
export type VisibilityLevel = 'nur_vorstand' | 'trainer' | 'mitglieder';

export const VISIBILITY_FIELDS: readonly VisibilityField[] = ['phone', 'email', 'address', 'photo'];
export const VISIBILITY_LEVELS: readonly VisibilityLevel[] = ['nur_vorstand', 'trainer', 'mitglieder'];

export type VisibilityLevels = Record<VisibilityField, VisibilityLevel>;

/** Unknown or missing levels count as the most private one (deny by default). */
export function normalizeLevels(raw: unknown): VisibilityLevels {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (v: unknown): VisibilityLevel => (v === 'trainer' || v === 'mitglieder' ? v : 'nur_vorstand');
  return { phone: pick(src.phone), email: pick(src.email), address: pick(src.address), photo: pick(src.photo) };
}

export interface DataRequest {
  id: string;
  kind: 'access' | 'erasure' | string;
  status: 'open' | 'in_progress' | 'done' | 'rejected' | string;
  receivedAt: string;
  dueAt: string;
  completedAt: string | null;
}

export const isOpenRequest = (r: Pick<DataRequest, 'status'>): boolean => r.status === 'open' || r.status === 'in_progress';

/** Whole days until the deadline (negative once passed), rounded up so "due today" is 0. */
export function daysUntil(dueAt: string, now: Date = new Date()): number {
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return 0;
  return Math.ceil((due - now.getTime()) / 86_400_000);
}

export interface ExportSummary {
  generatedAt: string | null;
  sections: { key: string; count: number }[];
  files: number;
}

/** Condenses `GET /club-members/me/data-export` to counts per section, so the app never keeps the content itself. */
export function summarizeExport(data: unknown): ExportSummary {
  const d = (data && typeof data === 'object' ? data : {}) as { generatedAt?: unknown; sections?: unknown; files?: unknown };
  const sections =
    d.sections && typeof d.sections === 'object'
      ? Object.entries(d.sections as Record<string, unknown>).map(([key, value]) => ({
          key,
          count: Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : value == null ? 0 : 1,
        }))
      : [];
  return { generatedAt: typeof d.generatedAt === 'string' ? d.generatedAt : null, sections, files: Array.isArray(d.files) ? d.files.length : 0 };
}

export interface DpaCurrent {
  version: { id: string; version: number; title: string } | null;
  status: { required: boolean; accepted: boolean; deadline: string | null; daysLeft: number | null; blocked: boolean };
  canAccept: boolean;
}

/** What the DPA card shows: the owner is asked to confirm on the website, others only see that writes are paused. */
export function dpaHint(dpa: DpaCurrent | null): 'owner-confirm' | 'blocked' | null {
  if (!dpa || !dpa.version || !dpa.status.required || dpa.status.accepted) return null;
  if (dpa.canAccept) return 'owner-confirm';
  return dpa.status.blocked ? 'blocked' : null;
}
