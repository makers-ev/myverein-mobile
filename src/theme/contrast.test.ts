import { FIXED_COLORS, palettes, type TokenSet } from './palettes';
import { blend, contrastRatio } from './contrast';
import { deriveTokens } from './deriveTokens';

type Key = keyof TokenSet;
const SURFACES: Key[] = ['background', 'card', 'muted'];

// WCAG AA: 4.5:1 for text, 3:1 for the boundary of a control. Pairs that carry text in the UI ("Vereinsheim" design,
// handoff section 3), checked for every built-in palette in light and dark.
const TEXT_PAIRS: [Key, Key][] = [
  ...SURFACES.flatMap((s): [Key, Key][] => [
    ['foreground', s],
    ['mutedForeground', s],
    ['primaryText', s],
    ['accent', s],
  ]),
  ['primaryForeground', 'primary'],
  ['primaryText', 'primarySoft'],
  ['primarySoftForeground', 'primarySoft'],
  ['accentForeground', 'accent'],
  ['accentSoftForeground', 'accentSoft'],
  ['foreground', 'primarySoft'],
];
const CONTROL_PAIRS: [Key, Key][] = [
  ['borderControl', 'card'],
  ['borderControl', 'background'],
];

function failures(tokens: TokenSet): string[] {
  const out: string[] = [];
  for (const [fg, bg] of TEXT_PAIRS) {
    const r = contrastRatio(tokens[fg], tokens[bg]);
    if (r < 4.5) out.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
  }
  for (const [fg, bg] of CONTROL_PAIRS) {
    const r = contrastRatio(tokens[fg], tokens[bg]);
    if (r < 3) out.push(`${fg} on ${bg}: ${r.toFixed(2)} (control, needs 3:1)`);
  }
  return out;
}

describe('palette contrast (WCAG AA: text 4.5:1, controls 3:1)', () => {
  for (const [name, palette] of Object.entries(palettes)) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${name} ${mode}`, () => {
        expect(failures(palette[mode])).toEqual([]);
      });
    }
  }
});

describe('surface steps', () => {
  it('Vereinsblau dark: card and muted are visibly stepped from the canvas (decision D1)', () => {
    const d = palettes.vereinsblau.dark;
    expect(contrastRatio(d.card, d.background)).toBeGreaterThanOrEqual(1.15);
    expect(contrastRatio(d.muted, d.background)).toBeGreaterThanOrEqual(1.35);
  });

  it('dark primary fills take white text (decision D4)', () => {
    for (const palette of Object.values(palettes)) {
      expect(palette.dark.primaryForeground.toLowerCase()).toBe('#ffffff');
      expect(contrastRatio('#ffffff', palette.dark.primary)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('semantic colors (WCAG AA 4.5:1)', () => {
  for (const [name, palette] of Object.entries(palettes)) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${name} ${mode}: danger, success, warning and info as text, on their soft tint and as badge`, () => {
        const tokens = palette[mode];
        const fixed = FIXED_COLORS[mode];
        const out: string[] = [];
        const tones = [
          ['destructive', 'destructiveSoft'],
          ['success', 'successSoft'],
          ['warning', 'warningSoft'],
          ['info', 'infoSoft'],
        ] as const;
        for (const [tone, soft] of tones) {
          for (const surface of SURFACES) {
            const ratio = contrastRatio(fixed[tone], tokens[surface]);
            if (ratio < 4.5) out.push(`${tone} on ${surface}: ${ratio.toFixed(2)}`);
            // Legacy tint (the tone at 10 % over the surface), still used by some feature chips.
            const tint = contrastRatio(fixed[tone], blend(fixed[tone], tokens[surface], 0.1));
            if (tint < 4.5) out.push(`${tone} on 10% tint over ${surface}: ${tint.toFixed(2)}`);
          }
          const onSoft = contrastRatio(fixed[tone], fixed[soft]);
          if (onSoft < 4.5) out.push(`${tone} on ${soft}: ${onSoft.toFixed(2)}`);
          const fgOnSoft = contrastRatio(tokens.foreground, fixed[soft]);
          if (fgOnSoft < 4.5) out.push(`foreground on ${soft}: ${fgOnSoft.toFixed(2)}`);
        }
        // Solid destructive fill (irreversible actions, the one red "needs action" count) with white text.
        const fill = contrastRatio(fixed.destructiveForeground, fixed.destructiveFill);
        if (fill < 4.5) out.push(`white on destructiveFill: ${fill.toFixed(2)}`);
        expect(out).toEqual([]);
      });
    }
  }
});

describe('custom palettes (deriveTokens)', () => {
  // A spread of anchors a club might pick: the defaults, a light yellow, a saturated red, a mid grey, a near-black.
  const anchors = [
    { background: '#ffffff', foreground: '#2e3338', primary: '#1e293b' },
    { background: '#1e1e1e', foreground: '#dcddde', primary: '#64748b' },
    { background: '#ffffff', foreground: '#111111', primary: '#f5d000' },
    { background: '#101418', foreground: '#f0f0f0', primary: '#ff3b30' },
    { background: '#fafafa', foreground: '#202020', primary: '#888888' },
    { background: '#0b0b0b', foreground: '#e5e5e5', primary: '#22b8cf' },
    { background: '#121212', foreground: '#eeeeee', primary: '#0a0a40' },
  ];
  for (const a of anchors) {
    it(`derived roles stay AA for ${a.background}/${a.foreground}/${a.primary}`, () => {
      const tokens = deriveTokens(a);
      const derived: [Key, Key, number][] = [
        ['primaryForeground', 'primary', 4.5],
        ['primarySoftForeground', 'primarySoft', 4.5],
        ['accentForeground', 'accent', 4.5],
        ...SURFACES.flatMap((s): [Key, Key, number][] => [
          ['primaryText', s, 4.5],
          ['mutedForeground', s, 4.5],
          ['borderControl', s, 3],
        ]),
      ];
      const out = derived.filter(([fg, bg, min]) => contrastRatio(tokens[fg], tokens[bg]) < min).map(([fg, bg]) => `${fg} on ${bg}: ${contrastRatio(tokens[fg], tokens[bg]).toFixed(2)}`);
      expect(out).toEqual([]);
    });
  }
});
