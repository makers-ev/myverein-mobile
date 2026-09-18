/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './App.tsx'],
  // "media" (the default) follows the OS light/dark setting via RN's
  // Appearance API with no manual toggle -- matches userInterfaceStyle:
  // "automatic" in app.json.
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
        // Fixed regardless of palette (ADR-008) -- danger color shouldn't
        // shift with the chosen accent, so this stays a plain static hex.
        destructive: { DEFAULT: '#DC2626', dark: '#DC2626' },
      },
    },
  },
  plugins: [],
};
