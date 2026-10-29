import { parseMarkdown, safeHref } from './markdown';

describe('safeHref', () => {
  it('allows only http(s) and mailto', () => {
    expect(safeHref('https://example.org/a?b=1')).toBe('https://example.org/a?b=1');
    expect(safeHref('http://example.org')).toBe('http://example.org');
    expect(safeHref('mailto:vorstand@example.org')).toBe('mailto:vorstand@example.org');
  });

  it('refuses script, data, relative and malformed targets', () => {
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '/intern', 'example.org', 'https://', 'java\nscript:x', '']) {
      expect(safeHref(bad)).toBeNull();
    }
  });
});

describe('parseMarkdown', () => {
  it('parses headings, paragraphs and lists', () => {
    const blocks = parseMarkdown('# Satzung\n\nErster Absatz\nzweite Zeile\n\n- a\n- b\n\n1. eins\n2. zwei');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(blocks[2]).toMatchObject({ ordered: false });
    expect(blocks[3]).toMatchObject({ ordered: true });
    expect((blocks[3] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('keeps raw HTML as literal text', () => {
    const [p] = parseMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(p).toEqual({ type: 'paragraph', children: [{ type: 'text', text: '<script>alert(1)</script><img src=x onerror=alert(1)>' }] });
  });

  it('turns an unsafe link into plain label text', () => {
    const [p] = parseMarkdown('[klick](javascript:alert(1)) und [ok](https://example.org)');
    const children = (p as { children: { type: string }[] }).children;
    expect(children.filter((c) => c.type === 'link')).toHaveLength(1);
    expect(children[0]).toEqual({ type: 'text', text: 'klick' });
  });

  it('handles bold, italic and code and clamps heading levels', () => {
    const blocks = parseMarkdown('###### Klein\n\n**fett** *kursiv* `x`');
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 3 });
    expect((blocks[1] as { children: { type: string }[] }).children.map((c) => c.type)).toEqual(['bold', 'text', 'italic', 'text', 'code']);
  });

  it('does not hang on unbalanced input', () => {
    expect(() => parseMarkdown('*'.repeat(5000) + '[' .repeat(3000) + '`')).not.toThrow();
  });
});

describe('tables', () => {
  const text = (nodes: { type: string; text?: string }[]) => nodes.map((n) => n.text ?? '').join('');

  it('parses the sample table instead of a paragraph', () => {
    const blocks = parseMarkdown('| Kategorie | Jahresbeitrag |\n| --- | --- |\n| Aktiv | 120 € |');
    expect(blocks).toHaveLength(1);
    const t = blocks[0] as Extract<(typeof blocks)[number], { type: 'table' }>;
    expect(t.type).toBe('table');
    expect(t.header.map(text)).toEqual(['Kategorie', 'Jahresbeitrag']);
    expect(t.rows.map((r) => r.map(text))).toEqual([['Aktiv', '120 €']]);
    expect(t.align).toEqual([null, null]);
  });

  it('reads alignment, inline formatting, escaped pipes and tolerates ragged rows and missing outer pipes', () => {
    const [t] = parseMarkdown('A | B | C\n:-- | :-: | --:\n**x** | a \\| b\n1 | 2 | 3 | 4\n\nafter') as never[];
    const table = t as { type: string; align: unknown[]; rows: { type: string; text?: string }[][][] };
    expect(table.align).toEqual(['left', 'center', 'right']);
    expect(table.rows[0]![0]![0]!.type).toBe('bold');
    expect(text(table.rows[0]![1]!)).toBe('a | b');
    expect(table.rows[0]![2]).toEqual([]);
    expect(table.rows[1]!.map(text)).toEqual(['1', '2', '3']);
  });

  it('keeps consecutive table lines out of the paragraph, and a paragraph before/after intact', () => {
    const blocks = parseMarkdown('Intro\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\nText nach der Tabelle');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'table', 'paragraph']);
    expect((blocks[1] as { rows: unknown[] }).rows).toHaveLength(2);
  });

  it('does not make a table from a pipe line without a matching separator', () => {
    expect(parseMarkdown('a | b\n--- | ---\n').map((b) => b.type)).toEqual(['table']);
    expect(parseMarkdown('a | b | c\n--- | ---').map((b) => b.type)).toEqual(['paragraph']);
    expect(parseMarkdown('a | b\nplain text').map((b) => b.type)).toEqual(['paragraph']);
  });

  it('keeps links in cells safe', () => {
    const [t] = parseMarkdown('| l |\n|---|\n| [x](javascript:alert(1)) |') as never[];
    const cell = (t as { rows: { type: string }[][][] }).rows[0]![0]!;
    expect(cell.some((n) => n.type === 'link')).toBe(false);
  });
});
