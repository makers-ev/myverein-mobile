import { Directory, File, Paths } from 'expo-file-system';

import { createSerialQueue } from '@/lib/serialQueue';

/**
 * Read-only offline copies (Wave 14 N5) of the club list, the Kalender (events per loaded date range) and the member list (first page,
 * unfiltered, non-sensitive columns only -- see `toCachedMember`). One JSON file per kind and club in the app's private
 * document directory (`offline-cache/`), at most `MAX_ENTRIES` ranges per file. Never written to by the user: no offline
 * writes, no sync. Wiped completely on sign-out, when the session ends, when the account is deleted, and per club when the
 * person is no longer a member (`dropOfflineClub`). The membership card has its own copy (`memberCardCache.ts`).
 * All writes run through one queue and a wipe generation, so a late save can never resurrect wiped data. Nothing is
 * logged; failures are swallowed (the cache is an optimisation, never required).
 */
export type OfflineKind = 'events' | 'members' | 'clubs';

interface Entry<T> {
  savedAt: string;
  payload: T;
}

type FileShape = Record<string, Entry<unknown>>;

const DIR = 'offline-cache';
const MAX_ENTRIES = 8;
const queue = createSerialQueue();
let wipeGeneration = 0;

/** Club ids are UUIDs; anything else is refused so a key can never escape the directory. */
const safeId = (clubId: string): string | null => (/^[A-Za-z0-9-]{1,64}$/.test(clubId) ? clubId : null);

function fileFor(kind: OfflineKind, clubId: string): File | null {
  const id = safeId(clubId);
  return id ? new File(new Directory(Paths.document, DIR), `${kind}.${id}.json`) : null;
}

async function readFile(file: File): Promise<FileShape> {
  try {
    if (!file.exists) return {};
    const parsed = JSON.parse(await file.text()) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as FileShape) : {};
  } catch {
    return {};
  }
}

/** Keeps the newest `MAX_ENTRIES` keys by `savedAt`. */
export function trimEntries(entries: FileShape, max = MAX_ENTRIES): FileShape {
  const keys = Object.keys(entries).sort((a, b) => (entries[b]!.savedAt > entries[a]!.savedAt ? 1 : -1));
  return Object.fromEntries(keys.slice(0, max).map((k) => [k, entries[k]!]));
}

export function saveOffline<T>(kind: OfflineKind, clubId: string, key: string, payload: T): Promise<void> {
  const generation = wipeGeneration;
  return queue(async () => {
    try {
      const file = fileFor(kind, clubId);
      if (!file || generation !== wipeGeneration) return;
      new Directory(Paths.document, DIR).create({ idempotent: true, intermediates: true });
      const entries = await readFile(file);
      entries[key] = { savedAt: new Date().toISOString(), payload };
      if (generation !== wipeGeneration) return;
      file.create({ overwrite: true });
      file.write(JSON.stringify(trimEntries(entries)));
    } catch {
      // best-effort
    }
  });
}

export function loadOffline<T>(kind: OfflineKind, clubId: string, key: string): Promise<{ savedAt: string; payload: T } | null> {
  return queue(async () => {
    try {
      const file = fileFor(kind, clubId);
      if (!file) return null;
      const entry = (await readFile(file))[key];
      return entry && typeof entry.savedAt === 'string' ? { savedAt: entry.savedAt, payload: entry.payload as T } : null;
    } catch {
      return null;
    }
  });
}

/** Removes the copies of one club (the person left or was removed). */
export function dropOfflineClub(clubId: string): Promise<void> {
  wipeGeneration++;
  return queue(async () => {
    try {
      for (const kind of ['events', 'members'] as const) {
        const file = fileFor(kind, clubId);
        if (file?.exists) file.delete();
      }
    } catch {
      // best-effort
    }
  });
}

/** Removes the copies of every club that is not in `keepClubIds` (called with the fresh membership list). */
export function pruneOfflineClubs(keepClubIds: string[]): Promise<void> {
  return queue(async () => {
    try {
      const dir = new Directory(Paths.document, DIR);
      if (!dir.exists) return;
      for (const item of dir.list()) {
        const m = /^(events|members)\.([A-Za-z0-9-]+)\.json$/.exec(item.name);
        if (m && !keepClubIds.includes(m[2]!) && item instanceof File) item.delete();
      }
    } catch {
      // best-effort
    }
  });
}

/** Removes every offline copy (sign-out, session ended, account deleted). */
export function clearOfflineCache(): Promise<void> {
  wipeGeneration++;
  return queue(async () => {
    try {
      const dir = new Directory(Paths.document, DIR);
      if (dir.exists) dir.delete();
    } catch {
      // best-effort
    }
  });
}

/** The columns of a member that are safe to keep on the device: no contact data, birth date, address or signed photo URL. */
export function toCachedMember<M extends { id: string; memberId: string | null; userId: string | null; hasAccount: boolean; name: string | null; status: unknown; effectiveStatus: unknown; category: string | null; categoryId: string | null; categoryName: string | null; categoryObject: unknown; joinedAt: string | null; leftAt: string | null; orgRole: string | null; roles: unknown; departments: unknown }>(m: M) {
  return {
    id: m.id,
    memberId: m.memberId,
    userId: m.userId,
    hasAccount: m.hasAccount,
    name: m.name,
    status: m.status,
    effectiveStatus: m.effectiveStatus,
    category: m.category,
    categoryId: m.categoryId,
    categoryName: m.categoryName,
    categoryObject: m.categoryObject,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
    orgRole: m.orgRole,
    roles: m.roles,
    departments: m.departments,
  };
}
