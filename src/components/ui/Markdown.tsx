import React, { useMemo } from 'react';
import { Linking, Text, View } from 'react-native';

import { parseMarkdown, safeHref, type Block, type Inline } from '@/lib/markdown';

function renderInline(nodes: Inline[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}.${i}`;
    switch (n.type) {
      case 'text':
        return n.text;
      case 'bold':
        return (
          <Text key={key} style={{ fontWeight: '700' }}>
            {renderInline(n.children, key)}
          </Text>
        );
      case 'italic':
        return (
          <Text key={key} style={{ fontStyle: 'italic' }}>
            {renderInline(n.children, key)}
          </Text>
        );
      case 'code':
        return (
          <Text key={key} style={{ fontFamily: 'monospace' }}>
            {n.text}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            accessibilityRole="link"
            className="text-primary dark:text-primary-dark underline"
            onPress={() => {
              // Re-checked at press time: the tree is already safe, this keeps the guarantee local to the call.
              const href = safeHref(n.href);
              if (href) void Linking.openURL(href).catch(() => undefined);
            }}
          >
            {renderInline(n.children, key)}
          </Text>
        );
    }
  });
}

const HEADING_CLASS = {
  1: 'text-xl font-black mt-2 mb-2',
  2: 'text-lg font-bold mt-2 mb-1.5',
  3: 'text-base font-bold mt-1 mb-1',
} as const;

function BlockView({ block, index }: { block: Block; index: number }) {
  const key = `b${index}`;
  switch (block.type) {
    case 'heading':
      return (
        <Text accessibilityRole="header" className={`text-foreground dark:text-foreground-dark ${HEADING_CLASS[block.level]}`}>
          {renderInline(block.children, key)}
        </Text>
      );
    case 'paragraph':
      return <Text className="text-foreground dark:text-foreground-dark text-sm leading-5 mb-3">{renderInline(block.children, key)}</Text>;
    case 'quote':
      return (
        <View className="border-l-4 border-border dark:border-border-dark pl-3 mb-3">
          <Text className="text-muted-foreground dark:text-muted-foreground-dark text-sm leading-5 italic">{renderInline(block.children, key)}</Text>
        </View>
      );
    case 'code':
      return (
        <View className="bg-muted dark:bg-muted-dark rounded-lg p-3 mb-3">
          <Text selectable className="text-foreground dark:text-foreground-dark text-xs" style={{ fontFamily: 'monospace' }}>
            {block.text}
          </Text>
        </View>
      );
    case 'rule':
      return <View className="h-px bg-border dark:bg-border-dark my-3" />;
    case 'list':
      return (
        <View className="mb-3">
          {block.items.map((item, i) => (
            <View key={`${key}.${i}`} className="flex-row mb-1" style={{ gap: 8 }}>
              <Text className="text-foreground dark:text-foreground-dark text-sm leading-5 w-5">{block.ordered ? `${i + 1}.` : '•'}</Text>
              <Text className="text-foreground dark:text-foreground-dark text-sm leading-5 flex-1">{renderInline(item, `${key}.${i}`)}</Text>
            </View>
          ))}
        </View>
      );
  }
}

/** Renders club document Markdown without any HTML path (see `lib/markdown.ts`): raw HTML is literal text, links are http(s)/mailto only. */
export default function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <View>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} index={i} />
      ))}
    </View>
  );
}
