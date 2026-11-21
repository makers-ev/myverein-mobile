import type { TextStyle } from 'react-native';

/**
 * Type scale of the "Vereinsheim" design (handoff section 4), as NativeWind class strings. System font, weights
 * 400/500/600 only, sentence case, no tracked uppercase. All sizes scale with the OS text size (`allowFontScaling` is
 * the default); layouts use `minHeight`, never a fixed height. Display styles (`Title/L`) are in `components/ui/Title`.
 *
 * | Style     | Size/line | Weight | Use                                            |
 * |-----------|-----------|--------|------------------------------------------------|
 * | headingM  | 20/26     | 600    | dialog/sheet title, section hero lines         |
 * | headingS  | 17/22     | 600    | card title, event title, person name           |
 * | bodyL     | 17/24     | 400    | list row title, input value, body              |
 * | bodyM     | 15/22     | 400    | secondary text, previews                       |
 * | labelM    | 15/20     | 500    | buttons, tabs                                  |
 * | labelS    | 13/18     | 500    | section headers, tags                          |
 * | labelXS   | 11/14     | 500    | bottom tab labels only (capped at 130 %)       |
 * | caption   | 13/18     | 400    | meta lines, helper text                        |
 * | numericL  | 28/32     | 600    | KPI numbers (with `tabular`)                   |
 */
export const type = {
  headingM: 'text-[20px] leading-[26px] font-semibold',
  headingS: 'text-[17px] leading-[22px] font-semibold',
  bodyL: 'text-[17px] leading-6',
  bodyM: 'text-[15px] leading-[22px]',
  labelM: 'text-[15px] leading-5 font-medium',
  labelS: 'text-[13px] leading-[18px] font-medium',
  labelXS: 'text-[11px] leading-[14px] font-medium',
  caption: 'text-[13px] leading-[18px]',
  numericL: 'text-[28px] leading-8 font-semibold',
} as const;

/** Text colour classes (light + dark). */
export const tone = {
  strong: 'text-foreground dark:text-foreground-dark',
  muted: 'text-muted-foreground dark:text-muted-foreground-dark',
  primary: 'text-primary dark:text-primary-dark',
  danger: 'text-destructive dark:text-destructive-dark',
  onPrimary: 'text-primary-foreground dark:text-primary-foreground-dark',
} as const;

/** Times, dates and counts line up (tabular figures). */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };
