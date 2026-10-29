import { palettes } from './palettes';
import { contrastRatio } from './contrast';

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
