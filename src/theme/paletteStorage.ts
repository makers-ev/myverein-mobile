import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PaletteAnchors } from './deriveTokens';

// Same convention as themePreferenceStorage.ts / appSettingsStorage.ts.
const PALETTE_ID_KEY = '_template_better-auth-mobile.color-palette-id';
const CUSTOM_ANCHORS_KEY = '_template_better-auth-mobile.color-palette-custom';

export async function getStoredPaletteId(): Promise<string | null> {
    return AsyncStorage.getItem(PALETTE_ID_KEY);
}

export async function setStoredPaletteId(id: string): Promise<void> {
    await AsyncStorage.setItem(PALETTE_ID_KEY, id);
}

export async function getStoredCustomAnchors(): Promise<{ light: PaletteAnchors; dark: PaletteAnchors } | null> {
    const raw = await AsyncStorage.getItem(CUSTOM_ANCHORS_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function setStoredCustomAnchors(anchors: { light: PaletteAnchors; dark: PaletteAnchors }): Promise<void> {
    await AsyncStorage.setItem(CUSTOM_ANCHORS_KEY, JSON.stringify(anchors));
}
