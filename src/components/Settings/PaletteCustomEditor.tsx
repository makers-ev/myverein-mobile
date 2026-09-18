import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import ColorPicker, { Panel1, HueSlider, Preview, type ColorFormatsObject } from 'reanimated-color-picker';

import type { PaletteAnchors } from '@/theme/deriveTokens';

type Mode = 'light' | 'dark';
type AnchorKey = keyof PaletteAnchors;

interface PaletteCustomEditorProps {
    customAnchors: { light: PaletteAnchors; dark: PaletteAnchors };
    onChange: (anchors: { light: PaletteAnchors; dark: PaletteAnchors }) => void;
}

// `hex` can come back as 8 digits (RRGGBBAA) since the library also supports
// alpha -- we never show OpacitySlider, but strip it defensively so a value
// always matches the plain `#rrggbb` deriveTokens.ts/palettes.ts expect.
function toOpaqueHex(hex: string): string {
    return '#' + hex.replace('#', '').slice(0, 6);
}

/** Tapping a swatch opens a bottom-sheet color picker (hue + saturation/
 * brightness panel) for that one anchor -- a real picker, not a hex field. */
export default function PaletteCustomEditor({ customAnchors, onChange }: PaletteCustomEditorProps) {
    const [editing, setEditing] = useState<{ mode: Mode; key: AnchorKey } | null>(null);

    const commitColor = (color: ColorFormatsObject) => {
        if (!editing) return;
        const { mode, key } = editing;
        onChange({ ...customAnchors, [mode]: { ...customAnchors[mode], [key]: toOpaqueHex(color.hex) } });
    };

    return (
        <>
            <View className="mt-3 flex-row" style={{ gap: 16 }}>
                {(['light', 'dark'] as const).map((mode) => (
                    <View key={mode} className="flex-1" style={{ gap: 6 }}>
                        <Text className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark capitalize">
                            {mode}
                        </Text>
                        {(['background', 'foreground', 'primary'] as const).map((key) => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => setEditing({ mode, key })}
                                className="flex-row items-center justify-between px-2 py-1.5 rounded bg-muted dark:bg-muted-dark border border-border dark:border-border-dark"
                            >
                                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark capitalize">{key}</Text>
                                <View
                                    className="w-6 h-6 rounded-full border border-border dark:border-border-dark"
                                    style={{ backgroundColor: customAnchors[mode][key] }}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </View>

            <Modal visible={editing !== null} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <TouchableOpacity className="flex-1" onPress={() => setEditing(null)} activeOpacity={1} />
                    <View className="bg-card dark:bg-card-dark rounded-t-3xl p-6">
                        {editing && (
                            <ColorPicker value={customAnchors[editing.mode][editing.key]} onCompleteJS={commitColor}>
                                <Preview style={{ marginBottom: 16, borderRadius: 8 }} />
                                <Panel1 style={{ height: 160, borderRadius: 8, marginBottom: 16 }} />
                                <HueSlider style={{ borderRadius: 8 }} />
                            </ColorPicker>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}
