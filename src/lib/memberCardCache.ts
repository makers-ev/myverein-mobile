import { Directory, File, Paths } from 'expo-file-system';

import { secureStore } from '@/lib/appStorage';
import { createSerialQueue } from '@/lib/serialQueue';
import { readWithMigration, removeItem, writeItem } from '@/lib/storageMigration';
import { type CachedCard, type MemberCard, parseCachedCard, photoNeedsRefresh, toCachedCard } from './memberCard';

/**
 * Offline copy of the membership card (Wave 13 M6). The record (name, number, category, club, token, validity) lives in
 * `expo-secure-store` (keychain/keystore, key `myverein.member-card.<subject>`), an index key lists the subjects so a wipe
 * finds them all, and the photo is a file in the app's private document directory (`member-card/`). Everything is removed
 * on sign-out, when the session ends, when the card is no longer valid (revoked, left, expired) and when the server says
 * there is no card. All writes run through one queue so a late save can never resurrect a wiped entry.
 * Nothing is logged; failures are swallowed (the cache is an optimisation, never required).
 */
const INDEX_KEY = 'member-card-index';
const entryKey = (subject: string) => `member-card.${subject}`;
const PHOTO_DIR = 'member-card';
const queue = createSerialQueue();
/** Bumped by every wipe: a save that started before the wipe checks it and discards its result. */
let wipeGeneration = 0;

async function readIndex(): Promise<string[]> {
  try {
    const raw = await readWithMigration(secureStore, INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const writeIndex = (list: string[]) => writeItem(secureStore, INDEX_KEY, JSON.stringify(list));

function deletePhoto(subject: string): void {
  try {
    const dir = new Directory(Paths.document, PHOTO_DIR);
    const file = new File(dir, `${subject}.jpg`);
    if (file.exists) file.delete();
  } catch {
    // best-effort
  }
}

export function loadCachedCard(subject: string, userId: string): Promise<CachedCard | null> {
  return queue(async () => {
    try {
      return parseCachedCard(await readWithMigration(secureStore, entryKey(subject)), userId);
    } catch {
      return null;
    }
  });
}

/** Local photo file of a cached card (rebuilt from the stored file name), or `null` when it is gone. */
export function cardPhotoUri(photoFile: string | null | undefined): string | null {
  if (!photoFile) return null;
  try {
    const file = new File(new Directory(Paths.document, PHOTO_DIR), photoFile);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Downloads the photo; returns the stored file name. */
async function downloadPhoto(subject: string, url: string): Promise<string | null> {
  try {
    const dir = new Directory(Paths.document, PHOTO_DIR);
    dir.create({ idempotent: true, intermediates: true });
    const dest = new File(dir, `${subject}.jpg`);
    const downloaded = await File.downloadFileAsync(url, dest, { idempotent: true });
    return downloaded.name;
  } catch {
    return null;
  }
}

/** Stores a valid card (and, when due, its photo). Returns the stored record, or `null` when nothing was kept. */
export function saveCachedCard(subject: string, card: MemberCard, userId: string, previous: CachedCard | null): Promise<CachedCard | null> {
  const generation = wipeGeneration;
  return queue(async () => {
    try {
      if (generation !== wipeGeneration) return null;
      const now = Date.now();
      let photoFile = previous?.photoFile ?? null;
      let photoSavedAt = previous?.photoSavedAt ?? null;
      if (card.photo?.url && photoNeedsRefresh(previous, true, now)) {
        const name = await downloadPhoto(subject, card.photo.url);
        if (name) {
          photoFile = name;
          photoSavedAt = new Date(now).toISOString();
        }
      } else if (!card.photo) {
        // No photo (consent withdrawn or none): the local copy goes too.
        deletePhoto(subject);
        photoFile = null;
        photoSavedAt = null;
      }
      if (generation !== wipeGeneration) {
        deletePhoto(subject);
        return null;
      }
      const record = toCachedCard(card, userId, photoFile, photoSavedAt, new Date(now));
      await writeItem(secureStore, entryKey(subject), JSON.stringify(record));
      const index = await readIndex();
      if (!index.includes(subject)) await writeIndex([...index, subject]);
      return record;
    } catch {
      return null;
    }
  });
}

/** Removes one subject's record and photo (card revoked, expired, left, or gone on the server). */
export function dropCachedCard(subject: string): Promise<void> {
  return queue(async () => {
    try {
      await removeItem(secureStore, entryKey(subject));
      deletePhoto(subject);
      const index = await readIndex();
      if (index.includes(subject)) await writeIndex(index.filter((s) => s !== subject));
    } catch {
      // best-effort
    }
  });
}

/** Removes every cached card and photo (sign-out, session ended, account deleted). */
export function clearAllCardCache(): Promise<void> {
  wipeGeneration++;
  return queue(async () => {
    try {
      const index = await readIndex();
      for (const subject of index) await removeItem(secureStore, entryKey(subject)).catch(() => undefined);
      await removeItem(secureStore, INDEX_KEY).catch(() => undefined);
    } catch {
      // best-effort
    }
    try {
      const dir = new Directory(Paths.document, PHOTO_DIR);
      if (dir.exists) dir.delete();
    } catch {
      // best-effort
    }
  });
}
