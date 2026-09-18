import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';

import { palettes, DEFAULT_PALETTE_ID, isPredefinedPaletteId, type PaletteId, type TokenSet } from './palettes';
import { deriveTokens, hexToRgbTriplet, type PaletteAnchors } from './deriveTokens';
import {
    getStoredPaletteId,
    setStoredPaletteId,
    getStoredCustomAnchors,
    setStoredCustomAnchors,
} from './paletteStorage';

const DEFAULT_CUSTOM: { light: PaletteAnchors; dark: PaletteAnchors } = {
    light: { background: '#ffffff', foreground: '#2e3338', primary: '#1e293b' },
    dark: { background: '#1e1e1e', foreground: '#dcddde', primary: '#64748b' },
};

// Maps each TokenSet key to the CSS-var stem NativeWind's `vars()` writes and
// tailwind.config.js's `rgb(var(--x) / <alpha-value>)` reads -- both light
// and dark values are always injected together (`--color-x` / `--color-x-dark`),
// same "-dark"-suffix convention this repo already uses for static colors.
const TOKEN_VAR_STEMS: Record<keyof TokenSet, string> = {
    background: '--color-background',
    foreground: '--color-foreground',
    card: '--color-card',
    muted: '--color-muted',
    mutedForeground: '--color-muted-foreground',
    border: '--color-border',
    primary: '--color-primary',
    primaryForeground: '--color-primary-foreground',
    accent: '--color-accent',
    accentForeground: '--color-accent-foreground',
};

interface PaletteContextValue {
    paletteId: PaletteId;
    setPaletteId: (id: PaletteId) => void;
    customAnchors: { light: PaletteAnchors; dark: PaletteAnchors };
    setCustomAnchors: (anchors: { light: PaletteAnchors; dark: PaletteAnchors }) => void;
    tokens: { light: TokenSet; dark: TokenSet };
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function usePalette(): PaletteContextValue {
    const ctx = useContext(PaletteContext);
    if (!ctx) throw new Error('usePalette must be used within PaletteProvider');
    return ctx;
}

/**
 * Injects the selected palette as NativeWind CSS variables (`vars()`) on a
 * root View -- tailwind.config.js's colors read `rgb(var(--color-x) /
 * <alpha-value>)`, so every existing `bg-card dark:bg-card-dark`-style
 * className keeps working unchanged, it just resolves a runtime value
 * instead of a build-time constant. RGB (not hex) values because Tailwind's
 * opacity modifiers (`bg-primary/10`) need the "R G B" triplet form to keep
 * working with a CSS-var color.
 */
export function PaletteProvider({ children }: { children: ReactNode }) {
    const [paletteId, setPaletteIdState] = useState<PaletteId>(DEFAULT_PALETTE_ID);
    const [customAnchors, setCustomAnchorsState] = useState(DEFAULT_CUSTOM);

    useEffect(() => {
        (async () => {
            const storedId = await getStoredPaletteId();
            if (storedId && (storedId === 'custom' || isPredefinedPaletteId(storedId))) {
                setPaletteIdState(storedId as PaletteId);
            }
            const storedCustom = await getStoredCustomAnchors();
            if (storedCustom) setCustomAnchorsState(storedCustom);
        })();
    }, []);

    const setPaletteId = (id: PaletteId) => {
        setPaletteIdState(id);
        void setStoredPaletteId(id);
    };

    const setCustomAnchors = (anchors: { light: PaletteAnchors; dark: PaletteAnchors }) => {
        setCustomAnchorsState(anchors);
        void setStoredCustomAnchors(anchors);
    };

    const tokens = useMemo(() => {
        if (paletteId === 'custom') {
            return { light: deriveTokens(customAnchors.light), dark: deriveTokens(customAnchors.dark) };
        }
        return { light: palettes[paletteId].light, dark: palettes[paletteId].dark };
    }, [paletteId, customAnchors]);

    const cssVars = useMemo(() => {
        const entries: Record<string, string> = {};
        for (const key of Object.keys(TOKEN_VAR_STEMS) as (keyof TokenSet)[]) {
            const stem = TOKEN_VAR_STEMS[key];
            entries[stem] = hexToRgbTriplet(tokens.light[key]);
            entries[`${stem}-dark`] = hexToRgbTriplet(tokens.dark[key]);
        }
        return vars(entries);
    }, [tokens]);

    const value = useMemo(
        () => ({ paletteId, setPaletteId, customAnchors, setCustomAnchors, tokens }),
        [paletteId, customAnchors, tokens],
    );

    return (
        <PaletteContext.Provider value={value}>
            <View style={cssVars} className="flex-1">
                {children}
            </View>
        </PaletteContext.Provider>
    );
}
