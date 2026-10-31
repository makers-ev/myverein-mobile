// Minimal, dependency-free Markdown parser for club documents (Wave 13 M1). It produces a small typed tree that
// `components/ui/Markdown.tsx` renders with plain <Text>/<View>, so there is NO HTML path at all: raw HTML in the source
// is just text, and the only link targets that survive are http(s) and mailto (everything else renders as plain text).
// Supported: # ## ### headings, paragraphs, - * + bullet and 1. ordered lists, > quotes, fenced code, --- rules,
// GFM pipe tables (header, `---`/`:--`/`:-:`/`--:` separator, rows, escaped `\|`, ragged rows padded/cut to the header),
// **bold**, *italic* / _italic_, `code`, [label](url). Anything else is shown literally. Pure, so it is unit-tested.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'table'; align: TableAlign[]; header: Inline[][]; rows: Inline[][][] }
  | { type: 'rule' };

export type TableAlign = 'left' | 'center' | 'right' | null;

const MAX_SOURCE = 100_000;
const MAX_DEPTH = 4;
const MAX_TABLE_COLS = 20;
const MAX_TABLE_ROWS = 500;

/** Cells of a pipe row: outer pipes optional, `\|` stays a literal pipe inside a cell. */
export function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (t[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
}

/** Alignment per column when `line` is a table separator row (`| --- | :-: |`), otherwise `null`. */
export function parseTableSeparator(line: string): TableAlign[] | null {
  if (!line.includes('-') || !line.includes('|') && !/^\s*:?-+:?\s*$/.test(line)) return null;
  const cells = splitTableRow(line);
  const align: TableAlign[] = [];
  for (const c of cells) {
    const m = /^(:)?-+(:)?$/.exec(c);
    if (!m) return null;
    align.push(m[1] && m[2] ? 'center' : m[2] ? 'right' : m[1] ? 'left' : null);
  }
  return align;
}

/** Only http(s) and mailto links are ever clickable; `javascript:`, `data:`, relative and scheme-less targets are not. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (href.length === 0 || href.length > 2000 || /[\s\u0000-\u001f\u007f]/.test(href)) return null;
  if (/^https?:\/\/[^/\s]+/i.test(href)) return href;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return href;
  return null;
}

function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ type: 'text', text: buf });
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '\\' && i + 1 < src.length && /[\\`*_[\]()#>-]/.test(src[i + 1]!)) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (depth < MAX_DEPTH && (src.startsWith('**', i) || src.startsWith('__', i))) {
      const mark = src.slice(i, i + 2);
      const end = src.indexOf(mark, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: 'bold', children: parseInline(src.slice(i + 2, end), depth + 1) });
        i = end + 2;
        continue;
      }
    }
    if (depth < MAX_DEPTH && (ch === '*' || ch === '_')) {
      const end = src.indexOf(ch, i + 1);
      if (end > i + 1 && src[i + 1] !== ' ' && src[end - 1] !== ' ') {
        flush();
        out.push({ type: 'italic', children: parseInline(src.slice(i + 1, end), depth + 1) });
        i = end + 1;
        continue;
      }
    }
    if (depth < MAX_DEPTH && ch === '[') {
      const m = /^\[([^\]]*)\]\(([^)\s]*)\)/.exec(src.slice(i));
      if (m) {
        const href = safeHref(m[2]!);
        flush();
        // An unsafe target keeps the label as plain text -- never a clickable element.
        if (href) out.push({ type: 'link', href, children: parseInline(m[1]!, depth + 1) });
        else out.push(...parseInline(m[1]!, depth + 1));
        i += m[0].length;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.slice(0, MAX_SOURCE).replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) });
    para = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed === '') {
      flushPara();
      i += 1;
      continue;
    }
    if (trimmed.startsWith('```')) {
      flushPara();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        code.push(lines[i]!);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    // Table: a pipe row directly followed by a separator row with the same number of columns (it may interrupt a paragraph).
    if (trimmed.includes('|') && i + 1 < lines.length) {
      const align = parseTableSeparator(lines[i + 1]!);
      const head = splitTableRow(trimmed);
      if (align && align.length === head.length && head.length <= MAX_TABLE_COLS) {
        flushPara();
        const cols = head.length;
        const rows: Inline[][][] = [];
        i += 2;
        while (i < lines.length && rows.length < MAX_TABLE_ROWS && lines[i]!.trim() !== '' && lines[i]!.includes('|')) {
          const cells = splitTableRow(lines[i]!);
          rows.push(Array.from({ length: cols }, (_, c) => parseInline(cells[c] ?? '')));
          i += 1;
        }
        blocks.push({ type: 'table', align, header: head.map((c) => parseInline(c)), rows });
        continue;
      }
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(trimmed);
    if (heading) {
      flushPara();
      const level = Math.min(heading[1]!.length, 3) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2]!) });
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        quote.push(lines[i]!.trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', children: parseInline(quote.join(' ')) });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d{1,3}[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flushPara();
      const ordered = !bullet;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const t = lines[i]!.trim();
        const m = ordered ? /^\d{1,3}[.)]\s+(.*)$/.exec(t) : /^[-*+]\s+(.*)$/.exec(t);
        if (!m) break;
        items.push(parseInline(m[1]!));
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    para.push(trimmed);
    i += 1;
  }
  flushPara();
  return blocks;
}
