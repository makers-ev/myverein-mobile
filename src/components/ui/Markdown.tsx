import React, { useMemo } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';

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

function plainLength(nodes: Inline[]): number {
  return nodes.reduce((n, x) => n + (x.type === 'text' || x.type === 'code' ? x.text.length : plainLength(x.children)), 0);
}

/** Column widths from the longest cell (readable minimum, capped so one long cell wraps instead of stretching the table). */
function columnWidths(header: Inline[][], rows: Inline[][][]): number[] {
  return header.map((h, c) => {
    const longest = Math.max(plainLength(h), ...rows.map((r) => plainLength(r[c] ?? [])));
    return Math.min(220, Math.max(72, longest * 8 + 24));
  });
}

function TableView({ block, keyPrefix }: { block: Extract<Block, { type: 'table' }>; keyPrefix: string }) {
  const widths = columnWidths(block.header, block.rows);
  const cell = (nodes: Inline[], c: number, r: number, head: boolean) => (
    <View key={`${keyPrefix}.${r}.${c}`} style={{ width: widths[c] }} className={`px-2 py-2 border-r border-border dark:border-border-dark ${head ? 'bg-muted dark:bg-muted-dark' : ''}`}>
      <Text
        accessibilityRole={head ? 'header' : undefined}
        style={{ textAlign: block.align[c] ?? 'left', fontWeight: head ? '700' : '400' }}
        className="text-foreground dark:text-foreground-dark text-sm leading-5"
      >
        {renderInline(nodes, `${keyPrefix}.${r}.${c}`)}
      </Text>
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator role="grid" className="mb-3">
      <View className="border border-b-0 border-border dark:border-border-dark rounded-lg overflow-hidden">
        <View className="flex-row border-b border-border dark:border-border-dark">{block.header.map((h, c) => cell(h, c, 0, true))}</View>
        {block.rows.map((row, r) => (
          <View key={`${keyPrefix}.row${r}`} className="flex-row border-b border-border dark:border-border-dark">
            {row.map((cl, c) => cell(cl, c, r + 1, false))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
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
    case 'table':
      return <TableView block={block} keyPrefix={key} />;
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
