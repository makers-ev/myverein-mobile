/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './App.tsx'],
  // "media" (the default) follows the OS light/dark setting via RN's
  // Appearance API with no manual toggle -- matches userInterfaceStyle:
  // "automatic" in app.config.ts.
  darkMode: 'media',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // `rgb(var(--x) / <alpha-value>)` (Tailwind's own recommended pattern
        // for opacity-modifier-compatible CSS-var colors, e.g. `bg-primary/10`)
        // instead of static hex -- PaletteProvider.tsx injects the actual "R G
        // B" values at runtime via NativeWind's `vars()`, per palettes.ts
        // (ADR-008). `-dark` variables mirror this repo's existing
        // `dark:bg-x-dark` convention, now runtime-swappable too.
        background: { DEFAULT: 'rgb(var(--color-background) / <alpha-value>)', dark: 'rgb(var(--color-background-dark) / <alpha-value>)' },
        foreground: { DEFAULT: 'rgb(var(--color-foreground) / <alpha-value>)', dark: 'rgb(var(--color-foreground-dark) / <alpha-value>)' },
        card: { DEFAULT: 'rgb(var(--color-card) / <alpha-value>)', dark: 'rgb(var(--color-card-dark) / <alpha-value>)' },
        muted: { DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)', dark: 'rgb(var(--color-muted-dark) / <alpha-value>)' },
        'muted-foreground': { DEFAULT: 'rgb(var(--color-muted-foreground) / <alpha-value>)', dark: 'rgb(var(--color-muted-foreground-dark) / <alpha-value>)' },
        border: { DEFAULT: 'rgb(var(--color-border) / <alpha-value>)', dark: 'rgb(var(--color-border-dark) / <alpha-value>)' },
        primary: { DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)', dark: 'rgb(var(--color-primary-dark) / <alpha-value>)' },
        'primary-foreground': { DEFAULT: 'rgb(var(--color-primary-foreground) / <alpha-value>)', dark: 'rgb(var(--color-primary-foreground-dark) / <alpha-value>)' },
        accent: { DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)', dark: 'rgb(var(--color-accent-dark) / <alpha-value>)' },
        'accent-foreground': { DEFAULT: 'rgb(var(--color-accent-foreground) / <alpha-value>)', dark: 'rgb(var(--color-accent-foreground-dark) / <alpha-value>)' },
        // "Vereinsheim" roles (design handoff 2026, section 3): see TokenSet in src/theme/palettes.ts.
        'border-control': { DEFAULT: 'rgb(var(--color-border-control) / <alpha-value>)', dark: 'rgb(var(--color-border-control-dark) / <alpha-value>)' },
        'primary-text': { DEFAULT: 'rgb(var(--color-primary-text) / <alpha-value>)', dark: 'rgb(var(--color-primary-text-dark) / <alpha-value>)' },
        'primary-soft': { DEFAULT: 'rgb(var(--color-primary-soft) / <alpha-value>)', dark: 'rgb(var(--color-primary-soft-dark) / <alpha-value>)' },
        'primary-soft-foreground': { DEFAULT: 'rgb(var(--color-primary-soft-foreground) / <alpha-value>)', dark: 'rgb(var(--color-primary-soft-foreground-dark) / <alpha-value>)' },
        'accent-soft': { DEFAULT: 'rgb(var(--color-accent-soft) / <alpha-value>)', dark: 'rgb(var(--color-accent-soft-dark) / <alpha-value>)' },
        'accent-soft-foreground': { DEFAULT: 'rgb(var(--color-accent-soft-foreground) / <alpha-value>)', dark: 'rgb(var(--color-accent-soft-foreground-dark) / <alpha-value>)' },
        // Fixed regardless of palette (ADR-008) -- danger/success/warning/info colours shouldn't shift with the chosen
        // accent, so these stay plain static hex (matches FIXED_COLORS in src/theme/palettes.ts). `destructive`,
        // `success`, `warning`, `info` are text colours; `destructive-fill` is the solid red button with white text.
        destructive: { DEFAULT: '#A81818', dark: '#FCA5A5' },
        'destructive-fill': { DEFAULT: '#A81818', dark: '#B83232' },
        'destructive-soft': { DEFAULT: '#FBEAE8', dark: '#3B2224' },
        success: { DEFAULT: '#256B2B', dark: '#7BC67F' },
        'success-soft': { DEFAULT: '#E6F1E5', dark: '#1E3322' },
        warning: { DEFAULT: '#8A5310', dark: '#E8B84B' },
        'warning-soft': { DEFAULT: '#F8ECDA', dark: '#3A2E19' },
        info: { DEFAULT: '#1F5A8A', dark: '#8EC3EA' },
        'info-soft': { DEFAULT: '#E3EEF6', dark: '#1B2D3D' },
        scrim: '#0B0C0F',
      },
      // `text-primary` means "primary as text": it resolves to the `primaryText` token, which equals `primary` in light
      // mode and is the lighter, AA-readable variant in dark mode (the dark FILL is a mid-tone for white text and would
      // be too dark as text on the dark surfaces). Every existing `text-primary dark:text-primary-dark` keeps working.
      textColor: {
        primary: { DEFAULT: 'rgb(var(--color-primary-text) / <alpha-value>)', dark: 'rgb(var(--color-primary-text-dark) / <alpha-value>)' },
      },
    },
  },
  plugins: [],
};
