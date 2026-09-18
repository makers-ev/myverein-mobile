import type { TokenSet } from './palettes';

export interface PaletteAnchors {
    background: string;
    foreground: string;
    primary: string;
}

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
    return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

// Blends `from` toward `to` by `amount` (0..1) -- e.g. mix(background, foreground, 0.08)
// nudges background 8% of the way toward foreground, giving a "muted" tone
// that's clearly derived from the two anchors instead of an arbitrary gray.
function mix(from: string, to: string, amount: number): string {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    return rgbToHex([
        a[0] + (b[0] - a[0]) * amount,
        a[1] + (b[1] - a[1]) * amount,
        a[2] + (b[2] - a[2]) * amount,
    ]);
}

// Relative luminance (WCAG formula, simplified without gamma-correction --
// good enough for a "is this background light or dark" black/white pick).
function luminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function foregroundFor(background: string): string {
    return luminance(background) > 0.6 ? '#000000' : '#ffffff';
}

/**
 * Derives a full TokenSet from three anchor colors (ADR-008): card/muted/
 * border are fixed mixes of background+foreground, primary-foreground/
 * accent-foreground pick black or white by contrast. No WCAG contrast
 * enforcement -- a user can pick anchors that read poorly (see ADR-008
 * Negative/Risks, deliberately out of scope for this pass).
 */
export function deriveTokens({ background, foreground, primary }: PaletteAnchors): TokenSet {
    return {
        background,
        foreground,
        card: mix(background, foreground, 0.04),
        muted: mix(background, foreground, 0.08),
        mutedForeground: mix(foreground, background, 0.35),
        border: mix(background, foreground, 0.16),
        primary,
        primaryForeground: foregroundFor(primary),
        accent: primary,
        accentForeground: foregroundFor(primary),
    };
}

export function hexToRgbTriplet(hex: string): string {
    return hexToRgb(hex).join(' ');
}
