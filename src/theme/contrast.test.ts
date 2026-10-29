import { FIXED_COLORS, palettes } from './palettes';
import { blend, contrastRatio } from './contrast';

// WCAG AA: 4.5:1 for normal text. Pairs that carry text in the UI, for every built-in palette in light and dark.
const PAIRS: [keyof (typeof palettes)['vereinsblau']['light'], keyof (typeof palettes)['vereinsblau']['light']][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['mutedForeground', 'background'],
  ['mutedForeground', 'card'],
  ['mutedForeground', 'muted'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['primaryForeground', 'primary'],
  ['accentForeground', 'accent'],
  ['accent', 'background'],
  ['accent', 'card'],
  ['accent', 'muted'],
];

describe('palette contrast (WCAG AA 4.5:1)', () => {
  for (const [name, palette] of Object.entries(palettes)) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${name} ${mode}`, () => {
        const tokens = palette[mode] as Record<string, string>;
        const failures = PAIRS.filter(([fg, bg]) => contrastRatio(tokens[fg]!, tokens[bg]!) < 4.5).map(([fg, bg]) => `${fg} on ${bg}: ${contrastRatio(tokens[fg]!, tokens[bg]!).toFixed(2)}`);
        expect(failures).toEqual([]);
      });
    }
  }
});

describe('semantic colors (WCAG AA 4.5:1)', () => {
  for (const [name, palette] of Object.entries(palettes)) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${name} ${mode}: destructive, success and warning text on every surface and as badge`, () => {
        const tokens = palette[mode] as Record<string, string>;
        const fixed = FIXED_COLORS[mode] as Record<string, string>;
        const failures: string[] = [];
        for (const tone of ['destructive', 'success', 'warning'] as const) {
          for (const surface of ['background', 'card', 'muted'] as const) {
            const ratio = contrastRatio(fixed[tone]!, tokens[surface]!);
            if (ratio < 4.5) failures.push(`${tone} on ${surface}: ${ratio.toFixed(2)}`);
            // Badge: the tone as text on its own 10% tint over the surface (Badge and the Orte/Material chips).
            const tint = contrastRatio(fixed[tone]!, blend(fixed[tone]!, tokens[surface]!, 0.1));
            if (tint < 4.5) failures.push(`${tone} badge on ${surface}: ${tint.toFixed(2)}`);
          }
        }
        // White text on a solid destructive fill (unread counters, danger buttons).
        if (mode === 'light' && contrastRatio('#ffffff', fixed.destructive!) < 4.5) failures.push('white on destructive');
        expect(failures).toEqual([]);
      });
    }
  }
});
