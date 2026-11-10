import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type LayoutRectangle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useThemeColors } from '@/theme/colors';

interface Props<T extends string> {
  tabs: readonly { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}

const FADE = 48;

/**
 * In-screen tabs (Figma `Tab` + `Tab bar · scrollable`): underline tabs, Label/M, 24pt apart, 44pt targets, a hairline
 * under the row. When the tabs do not fit, the row scrolls and a 48pt fade to the canvas at the trailing edge shows
 * that there is more (the only gradient in the app); the active tab is scrolled into view. Place it edge to edge (it
 * brings its own 16pt gutter). Announced as a tab list with the selected state. Name kept for existing call sites.
 */
export default function TabChips<T extends string>({ tabs, active, onChange }: Props<T>) {
  const colors = useThemeColors();
  const scroll = useRef<ScrollView>(null);
  const layouts = useRef<Partial<Record<string, LayoutRectangle>>>({});
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const overflow = content > viewport + 1;
  const showFade = overflow && offset + viewport < content - 4;

  useEffect(() => {
    const box = layouts.current[active];
    if (!box || !overflow) return;
    if (box.x < offset || box.x + box.width > offset + viewport - FADE) {
      scroll.current?.scrollTo({ x: Math.max(0, box.x - 16), animated: false });
    }
    // Only when the active tab changes (or the row was measured).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, overflow]);

  return (
    <View className="border-b border-border dark:border-border-dark" onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        scrollEventThrottle={32}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.x)}
        onContentSizeChange={(w) => setContent(w)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 24 }}
      >
        {tabs.map(({ value, label }) => {
          const selected = active === value;
          return (
            <Pressable
              key={value}
              onPress={() => onChange(value)}
              onLayout={(e) => {
                layouts.current[value] = e.nativeEvent.layout;
              }}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text
                numberOfLines={1}
                className={`text-[15px] leading-5 ${selected ? 'font-semibold text-foreground dark:text-foreground-dark' : 'font-medium text-muted-foreground dark:text-muted-foreground-dark'}`}
              >
                {label}
              </Text>
              <View
                className={selected ? 'bg-primary-text dark:bg-primary-text-dark' : ''}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1 }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
      {showFade ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: FADE }}>
          <Svg width={FADE} height="100%">
            <Defs>
              <LinearGradient id="tabfade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
                <Stop offset="0.75" stopColor={colors.background} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={FADE} height="100%" fill="url(#tabfade)" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}
