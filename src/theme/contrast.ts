/** WCAG 2.x relative luminance / contrast ratio of two `#rrggbb` colours. */
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** `fg` at `alpha` over `bg` (both `#rrggbb`), as `#rrggbb` -- the colour a translucent badge background really shows. */
export function blend(fg: string, bg: string, alpha: number): string {
  const f = parseInt(fg.replace('#', ''), 16);
  const b = parseInt(bg.replace('#', ''), 16);
  const mixed = [16, 8, 0].map((shift) => Math.round(((f >> shift) & 255) * alpha + ((b >> shift) & 255) * (1 - alpha)));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
