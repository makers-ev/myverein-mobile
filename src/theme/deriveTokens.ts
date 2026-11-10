import type { TokenSet } from './palettes';
import { contrastRatio, luminance as relativeLuminance } from './contrast';

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

function foregroundFor(background: string): string {
    return contrastRatio('#ffffff', background) >= contrastRatio('#000000', background) ? '#ffffff' : '#000000';
}

/** Steps `color` toward `target` in 2 % increments until `ok` holds (or returns `target`). */
function walk(color: string, target: string, ok: (c: string) => boolean): string {
    for (let i = 0; i <= 50; i++) {
        const c = mix(color, target, i / 50);
        if (ok(c)) return c;
    }
    return target;
}

/**
 * Derives a full TokenSet from three anchor colors (ADR-008): card/muted/border are fixed mixes of background+foreground.
 * The "Vereinsheim" roles follow the same rule as the predefined palettes (decision D4) and are AA-checked here, so a
 * custom palette never produces an unreadable button, link or tag:
 * - `primary` fill: in dark mode the anchor is darkened until white text reaches 4.5:1 (mid-tone fill + white text);
 *   `primaryForeground` is whichever of white/black reads better.
 * - `primaryText`: the anchor, moved toward the foreground until it reaches 4.5:1 on canvas, card and muted.
 * - `*Soft`: 12-16 % of the hue over the card; `*SoftForeground` reaches 4.5:1 on it.
 * - `mutedForeground` is pushed toward the foreground until it reaches 4.5:1; `borderControl` reaches 3:1.
 * The anchors themselves (background vs. foreground) are the user's choice and are not changed.
 */
export function deriveTokens({ background, foreground, primary }: PaletteAnchors): TokenSet {
    const dark = relativeLuminance(background) < 0.2;
    const card = mix(background, foreground, 0.04);
    const muted = mix(background, foreground, 0.08);
    const surfaces = [background, card, muted];
    const readable = (c: string, min: number) => surfaces.every((s) => contrastRatio(c, s) >= min);
    const mutedForeground = walk(mix(foreground, background, 0.35), foreground, (c) => readable(c, 4.5));
    const fill = dark && contrastRatio('#ffffff', primary) < 4.5 ? walk(primary, '#000000', (c) => contrastRatio('#ffffff', c) >= 4.6) : primary;
    const primaryText = walk(primary, foreground, (c) => readable(c, 4.6));
    const primarySoft = mix(card, primary, dark ? 0.16 : 0.1);
    const primarySoftForeground = walk(primaryText, foreground, (c) => contrastRatio(c, primarySoft) >= 4.6);
    const borderControl = walk(mix(card, mutedForeground, 0.5), mutedForeground, (c) => readable(c, 3));
    return {
        background,
        foreground,
        card,
        muted,
        mutedForeground,
        border: mix(background, foreground, 0.16),
        borderControl,
        primary: fill,
        primaryForeground: foregroundFor(fill),
        primaryText,
        primarySoft,
        primarySoftForeground,
        accent: primaryText,
        accentForeground: foregroundFor(primaryText),
        accentSoft: primarySoft,
        accentSoftForeground: primarySoftForeground,
    };
}

export function hexToRgbTriplet(hex: string): string {
    return hexToRgb(hex).join(' ');
}
