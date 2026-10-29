// Palette registry (ADR-008), mirrors the website's `src/theme/palettes.ts`
// values exactly so the two platforms look the same. Wave 14 N5: muted text and the ink-navy dark accent were
// darkened/lightened to reach WCAG AA (4.5:1), guarded by `contrast.test.ts` -- keep the website in step. `destructive`/`success`
// in colors.ts stay outside the palette -- semantic colors (danger/success)
// shouldn't drift with the chosen accent.
export interface TokenSet {
    background: string;
    foreground: string;
    card: string;
    muted: string;
    mutedForeground: string;
    border: string;
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
}

export interface Palette {
    label: string;
    light: TokenSet;
    dark: TokenSet;
}

export const palettes = {
    // Mirrors the website's src/theme/palettes.ts "vereinsblau" entry
    // exactly, see that file's comment for the reasoning.
    vereinsblau: {
        label: 'Vereinsblau',
        light: {
            background: '#fafaf7', foreground: '#22252b',
            card: '#ffffff', muted: '#eef0f2', mutedForeground: '#5b6270',
            border: '#e2e4e8',
            primary: '#2c4870', primaryForeground: '#ffffff',
            accent: '#8a6408', accentForeground: '#ffffff',
        },
        dark: {
            background: '#16181d', foreground: '#e8e9ec',
            card: '#1e2127', muted: '#282b32', mutedForeground: '#b4b8c0',
            border: '#343841',
            primary: '#7a9bc7', primaryForeground: '#16181d',
            accent: '#e0b84d', accentForeground: '#16181d',
        },
    },
    'ink-navy': {
        label: 'Ink Navy',
        light: {
            background: '#ffffff', foreground: '#2e3338',
            card: '#ffffff', muted: '#f1f2f4', mutedForeground: '#5b6270',
            border: '#e3e4e6',
            primary: '#1e293b', primaryForeground: '#ffffff',
            accent: '#1e293b', accentForeground: '#ffffff',
        },
        dark: {
            background: '#1e1e1e', foreground: '#dcddde',
            card: '#2a2a2b', muted: '#2a2a2b', mutedForeground: '#9a9a9d',
            border: '#3a3a3c',
            primary: '#8a9ab0', primaryForeground: '#1e1e1e',
            accent: '#8a9ab0', accentForeground: '#1e1e1e',
        },
    },
    ocean: {
        label: 'Ocean',
        light: {
            background: '#ffffff', foreground: '#1b2733',
            card: '#ffffff', muted: '#eef4f7', mutedForeground: '#5b7285',
            border: '#dde7ec',
            primary: '#0e7490', primaryForeground: '#ffffff',
            accent: '#0e7490', accentForeground: '#ffffff',
        },
        dark: {
            background: '#0f1b22', foreground: '#dbe7ec',
            card: '#16262e', muted: '#16262e', mutedForeground: '#8fa5b0',
            border: '#23343c',
            primary: '#22b8cf', primaryForeground: '#06222a',
            accent: '#22b8cf', accentForeground: '#06222a',
        },
    },
    forest: {
        label: 'Forest',
        light: {
            background: '#ffffff', foreground: '#232b24',
            card: '#ffffff', muted: '#f0f4ef', mutedForeground: '#5f6b61',
            border: '#dfe6dd',
            primary: '#2f6f4e', primaryForeground: '#ffffff',
            accent: '#2f6f4e', accentForeground: '#ffffff',
        },
        dark: {
            background: '#16201a', foreground: '#dde6da',
            card: '#1f2b23', muted: '#1f2b23', mutedForeground: '#90a08f',
            border: '#2c3a30',
            primary: '#5fae7f', primaryForeground: '#0d1a12',
            accent: '#5fae7f', accentForeground: '#0d1a12',
        },
    },
    sunset: {
        label: 'Sunset',
        light: {
            background: '#fffefb', foreground: '#322620',
            card: '#ffffff', muted: '#f6efe7', mutedForeground: '#765f4c',
            border: '#ece0d3',
            primary: '#c2542a', primaryForeground: '#ffffff',
            accent: '#b04a22', accentForeground: '#ffffff',
        },
        dark: {
            background: '#241813', foreground: '#ecdfd4',
            card: '#2e211a', muted: '#2e211a', mutedForeground: '#b39d8b',
            border: '#3d2c22',
            primary: '#e2793f', primaryForeground: '#241209',
            accent: '#e2793f', accentForeground: '#241209',
        },
    },
} satisfies Record<string, Palette>;

export type PaletteId = keyof typeof palettes | 'custom';
export const predefinedPaletteIds = Object.keys(palettes) as (keyof typeof palettes)[];
export const DEFAULT_PALETTE_ID: PaletteId = 'vereinsblau';

export function isPredefinedPaletteId(value: string): value is keyof typeof palettes {
    return Object.prototype.hasOwnProperty.call(palettes, value);
}

/**
 * Semantic colors, fixed regardless of the chosen palette (ADR-008). `destructive` is darker in light mode and lighter in
 * dark mode so red text/badges reach AA (4.5:1) on every surface -- text must pair `text-destructive` with
 * `dark:text-destructive-dark`. Mirrored in `tailwind.config.js`; `contrast.test.ts` checks them.
 */
export const FIXED_COLORS = {
  light: { destructive: '#A81818', success: '#256B2B', warning: '#8A5310' },
  dark: { destructive: '#FCA5A5', success: '#66BB6A', warning: '#E8B84B' },
} as const;
