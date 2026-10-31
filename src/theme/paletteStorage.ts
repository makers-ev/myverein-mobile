import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, writeItem } from '@/lib/storageMigration';

import type { PaletteAnchors } from './deriveTokens';

// Same convention as themePreferenceStorage.ts / appSettingsStorage.ts.
const PALETTE_ID_KEY = 'color-palette-id';
const CUSTOM_ANCHORS_KEY = 'color-palette-custom';

export async function getStoredPaletteId(): Promise<string | null> {
    return readWithMigration(asyncStore, PALETTE_ID_KEY);
}

export async function setStoredPaletteId(id: string): Promise<void> {
    await writeItem(asyncStore, PALETTE_ID_KEY, id);
}

export async function getStoredCustomAnchors(): Promise<{ light: PaletteAnchors; dark: PaletteAnchors } | null> {
    const raw = await readWithMigration(asyncStore, CUSTOM_ANCHORS_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function setStoredCustomAnchors(anchors: { light: PaletteAnchors; dark: PaletteAnchors }): Promise<void> {
    await writeItem(asyncStore, CUSTOM_ANCHORS_KEY, JSON.stringify(anchors));
}
