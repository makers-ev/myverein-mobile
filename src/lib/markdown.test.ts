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
