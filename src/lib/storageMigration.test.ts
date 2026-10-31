import { legacyStorageKey, readWithMigration, removeItem, storageKey, writeItem, type KeyValueStore } from './storageMigration';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (k) => (k in data ? data[k] : null),
    setItem: async (k, v) => {
      data[k] = v;
    },
    removeItem: async (k) => {
      delete data[k];
    },
  };
}

describe('storage keys', () => {
  it('uses the MyVerein prefix and keeps the legacy one for migration', () => {
    expect(storageKey('theme')).toBe('myverein.theme');
    expect(legacyStorageKey('theme')).toBe('_template_better-auth-mobile.theme');
  });
});

describe('readWithMigration', () => {
  it('prefers the new key', async () => {
    const store = memoryStore({ [storageKey('a')]: 'new', [legacyStorageKey('a')]: 'old' });
    expect(await readWithMigration(store, 'a')).toBe('new');
  });

  it('moves a legacy value to the new key', async () => {
    const store = memoryStore({ [legacyStorageKey('a')]: 'old' });
    expect(await readWithMigration(store, 'a')).toBe('old');
    expect(store.data).toEqual({ [storageKey('a')]: 'old' });
  });

  it('returns null when nothing is stored and still returns the value if the move fails', async () => {
    expect(await readWithMigration(memoryStore(), 'a')).toBeNull();
    const store = memoryStore({ [legacyStorageKey('a')]: 'old' });
    store.setItem = async () => {
      throw new Error('disk full');
    };
    expect(await readWithMigration(store, 'a')).toBe('old');
    expect(store.data[legacyStorageKey('a')]).toBe('old');
  });
});

describe('writeItem / removeItem', () => {
  it('writes the new key and drops a legacy copy', async () => {
    const store = memoryStore({ [legacyStorageKey('a')]: 'old' });
    await writeItem(store, 'a', 'v');
    expect(store.data).toEqual({ [storageKey('a')]: 'v' });
  });

  it('removes both keys', async () => {
    const store = memoryStore({ [legacyStorageKey('a')]: 'old', [storageKey('a')]: 'v' });
    await removeItem(store, 'a');
    expect(store.data).toEqual({});
  });
});
