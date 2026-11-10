// Palette registry (ADR-008), mirrors the website's `src/theme/palettes.ts` values exactly so the two platforms look the
// same. "Vereinsheim" design (2026): warm paper canvas, ink-blue for things you can act on, Pokal-Gold accent, three
// clearly stepped surfaces in dark mode (canvas / card / muted). Every text pair is AA (4.5:1) and every control boundary
// 3:1 in light and dark for every palette, guarded by `contrast.test.ts` -- keep the website in step.
// `destructive`/`success`/`warning`/`info` live in FIXED_COLORS below: semantic colours do not drift with the accent.
export interface TokenSet {
    /** Canvas behind everything (`bg/canvas`). */
    background: string;
    /** Strong text (`text/strong`). */
    foreground: string;
    /** Raised surface: cards, list sections, tab bar (`bg/surface`). */
    card: string;
    /** Sunken surface: facts blocks, skeletons, quiet fills (`bg/sunken`). */
    muted: string;
    /** Secondary text, meta lines, inactive tabs (`text/muted`). */
    mutedForeground: string;
    /** Decorative hairline between rows/cards (never the only cue). */
    border: string;
    /** Visible boundary of an interactive control (inputs, secondary buttons, switches off), at least 3:1. */
    borderControl: string;
    /** Solid fill of the primary action. */
    primary: string;
    /** Text/icons on `primary`. */
    primaryForeground: string;
    /** Primary as TEXT on canvas/card/muted (links, active tab label). Equal to `primary` in light mode. */
    primaryText: string;
    /** Quiet primary tint (selected chip, unread row, info-ish highlight). */
    primarySoft: string;
    /** Text/icons on `primarySoft`. */
    primarySoftForeground: string;
    /** The club's own accent (Pokal-Gold in Vereinsblau): Vorstand tags, crest, the card stripe. */
    accent: string;
    accentForeground: string;
    accentSoft: string;
    accentSoftForeground: string;
}

export interface Palette {
    label: string;
    light: TokenSet;
    dark: TokenSet;
}

export const palettes = {
    // Mirrors the website's src/theme/palettes.ts "vereinsblau" entry exactly (design handoff 2026, section 3.1/3.2,
    // dark = decision D1 "deeper canvas").
    vereinsblau: {
        label: 'Vereinsblau',
        light: {
            background: '#f7f5f0', foreground: '#1d2129',
            card: '#ffffff', muted: '#efece5', mutedForeground: '#585e6b',
            border: '#dedad0', borderControl: '#8c877b',
            primary: '#24416b', primaryForeground: '#ffffff',
            primaryText: '#24416b', primarySoft: '#e4eaf3', primarySoftForeground: '#1c3558',
            accent: '#8a6408', accentForeground: '#ffffff',
            accentSoft: '#f6ebcf', accentSoftForeground: '#5e4305',
        },
        dark: {
            background: '#0e1013', foreground: '#ecedef',
            card: '#1d2027', muted: '#2a2e37', mutedForeground: '#a9afba',
            border: '#353a45', borderControl: '#7d8492',
            primary: '#3f6db0', primaryForeground: '#ffffff',
            primaryText: '#93b3e3', primarySoft: '#1f2e45', primarySoftForeground: '#c9d9f2',
            accent: '#e0b84d', accentForeground: '#0e1013',
            accentSoft: '#3a3020', accentSoftForeground: '#f0d58e',
        },
    },
    // The other palettes keep their surfaces; the new roles are derived (decision D4): in dark mode the primary FILL is
    // the palette hue darkened until white text reaches AA, the former bright primary becomes `primaryText`.
    'ink-navy': {
        label: 'Ink Navy',
        light: {
            background: '#ffffff', foreground: '#2e3338',
            card: '#ffffff', muted: '#f1f2f4', mutedForeground: '#5b6270',
            border: '#e3e4e6', borderControl: '#878c97',
            primary: '#1e293b', primaryForeground: '#ffffff',
            primaryText: '#1e293b', primarySoft: '#e9eaeb', primarySoftForeground: '#1e293b',
            accent: '#1e293b', accentForeground: '#ffffff',
            accentSoft: '#e4e5e7', accentSoftForeground: '#1e293b',
        },
        dark: {
            background: '#1e1e1e', foreground: '#dcddde',
            card: '#2a2a2b', muted: '#2a2a2b', mutedForeground: '#9a9a9d',
            border: '#3a3a3c', borderControl: '#7a7a7c',
            primary: '#697586', primaryForeground: '#ffffff',
            primaryText: '#91a0b5', primarySoft: '#343538', primarySoftForeground: '#bcc5d2',
            accent: '#8a9ab0', accentForeground: '#1e1e1e',
            accentSoft: '#343538', accentSoftForeground: '#bcc5d2',
        },
    },
    ocean: {
        label: 'Ocean',
        light: {
            background: '#ffffff', foreground: '#1b2733',
            card: '#ffffff', muted: '#eef4f7', mutedForeground: '#5b7285',
            border: '#dde7ec', borderControl: '#7d909f',
            primary: '#0e7490', primaryForeground: '#ffffff',
            primaryText: '#0e7490', primarySoft: '#e7f1f4', primarySoftForeground: '#0b576c',
            accent: '#0e7490', accentForeground: '#ffffff',
            accentSoft: '#e2eef2', accentSoftForeground: '#0a5569',
        },
        dark: {
            background: '#0f1b22', foreground: '#dbe7ec',
            card: '#16262e', muted: '#16262e', mutedForeground: '#8fa5b0',
            border: '#23343c', borderControl: '#637781',
            primary: '#177f8f', primaryForeground: '#ffffff',
            primaryText: '#22b8cf', primarySoft: '#183d48', primarySoftForeground: '#7fd6e3',
            accent: '#22b8cf', accentForeground: '#06222a',
            accentSoft: '#183d48', accentSoftForeground: '#7fd6e3',
        },
    },
    forest: {
        label: 'Forest',
        light: {
            background: '#ffffff', foreground: '#232b24',
            card: '#ffffff', muted: '#f0f4ef', mutedForeground: '#5f6b61',
            border: '#dfe6dd', borderControl: '#858f87',
            primary: '#2f6f4e', primaryForeground: '#ffffff',
            primaryText: '#2f6f4e', primarySoft: '#eaf1ed', primarySoftForeground: '#26593e',
            accent: '#2f6f4e', accentForeground: '#ffffff',
            accentSoft: '#e6eeea', accentSoftForeground: '#25573d',
        },
        dark: {
            background: '#16201a', foreground: '#dde6da',
            card: '#1f2b23', muted: '#1f2b23', mutedForeground: '#90a08f',
            border: '#2c3a30', borderControl: '#6d7c6e',
            primary: '#46815e', primaryForeground: '#ffffff',
            primaryText: '#5fae7f', primarySoft: '#25382c', primarySoftForeground: '#9ccdb0',
            accent: '#5fae7f', accentForeground: '#0d1a12',
            accentSoft: '#25382c', accentSoftForeground: '#9ccdb0',
        },
    },
    sunset: {
        label: 'Sunset',
        light: {
            background: '#fffefb', foreground: '#322620',
            card: '#ffffff', muted: '#f6efe7', mutedForeground: '#765f4c',
            border: '#ece0d3', borderControl: '#9a897b',
            primary: '#c2542a', primaryForeground: '#ffffff',
            primaryText: '#b24d27', primarySoft: '#f9eeea', primarySoftForeground: '#84391d',
            accent: '#b04a22', accentForeground: '#ffffff',
            accentSoft: '#f6e9e4', accentSoftForeground: '#823719',
        },
        dark: {
            background: '#241813', foreground: '#ecdfd4',
            card: '#2e211a', muted: '#2e211a', mutedForeground: '#b39d8b',
            border: '#3d2c22', borderControl: '#837062',
            primary: '#b05e31', primaryForeground: '#ffffff',
            primaryText: '#e2793f', primarySoft: '#3c281d', primarySoftForeground: '#edab86',
            accent: '#e2793f', accentForeground: '#241209',
            accentSoft: '#3c281d', accentSoftForeground: '#edab86',
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
 * Semantic colors, fixed regardless of the chosen palette (ADR-008). `destructive`/`success`/`warning`/`info` are TEXT
 * colours (darker in light mode, lighter in dark mode) that reach AA on every surface and on their own `*Soft` tint;
 * `destructiveFill` is the solid red of an irreversible action with white text (`destructiveForeground`). Red means
 * "you must act" only. `scrim` is the overlay behind dialogs and sheets (use at 48 % opacity).
 * Mirrored in `tailwind.config.js`; `contrast.test.ts` checks every pair.
 */
export const FIXED_COLORS = {
  light: {
    destructive: '#A81818', destructiveFill: '#A81818', destructiveForeground: '#FFFFFF', destructiveSoft: '#FBEAE8',
    success: '#256B2B', successSoft: '#E6F1E5',
    warning: '#8A5310', warningSoft: '#F8ECDA',
    info: '#1F5A8A', infoSoft: '#E3EEF6',
    scrim: '#0B0C0F',
  },
  dark: {
    destructive: '#FCA5A5', destructiveFill: '#B83232', destructiveForeground: '#FFFFFF', destructiveSoft: '#3B2224',
    success: '#7BC67F', successSoft: '#1E3322',
    warning: '#E8B84B', warningSoft: '#3A2E19',
    info: '#8EC3EA', infoSoft: '#1B2D3D',
    scrim: '#0B0C0F',
  },
} as const;
