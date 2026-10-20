/**
 * Storage key naming (pure, no native modules). Every key of this app is `myverein.<name>`; the
 * keys written before the rename carried the template prefix and are still read once, copied to
 * the new key and removed, so no stored setting (language, palette, PIN, ...) is lost on update.
 */
export const STORAGE_PREFIX = 'myverein';
export const LEGACY_STORAGE_PREFIX = '_template_better-auth-mobile';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const storageKey = (name: string): string => `${STORAGE_PREFIX}.${name}`;
export const legacyStorageKey = (name: string): string => `${LEGACY_STORAGE_PREFIX}.${name}`;

/** Reads `name`; when only the legacy key exists its value is moved to the new key (best effort) and returned. */
export async function readWithMigration(store: KeyValueStore, name: string): Promise<string | null> {
  const current = await store.getItem(storageKey(name));
  if (current !== null) return current;
  const legacy = await store.getItem(legacyStorageKey(name));
  if (legacy === null) return null;
  try {
    await store.setItem(storageKey(name), legacy);
    await store.removeItem(legacyStorageKey(name));
  } catch {
    // The value is still returned; the move is retried on the next read.
  }
  return legacy;
}

export async function writeItem(store: KeyValueStore, name: string, value: string): Promise<void> {
  await store.setItem(storageKey(name), value);
  // A leftover legacy copy must not resurrect an older value later.
  await store.removeItem(legacyStorageKey(name)).catch(() => undefined);
}

/** Removes the new and the legacy key. */
export async function removeItem(store: KeyValueStore, name: string): Promise<void> {
  await store.removeItem(storageKey(name));
  await store.removeItem(legacyStorageKey(name)).catch(() => undefined);
}
