import FormsTranslation from './FormsTranslation';

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('FormsTranslation', () => {
  it('has identical key sets in German and English', () => {
    expect(Object.keys(FormsTranslation.en).sort()).toEqual(Object.keys(FormsTranslation.de).sort());
  });

  it('uses the same placeholders in both languages and has no empty texts', () => {
    for (const key of Object.keys(FormsTranslation.de)) {
      expect(FormsTranslation.de[key]).not.toBe('');
      expect(FormsTranslation.en[key]).not.toBe('');
      expect(placeholders(FormsTranslation.en[key])).toEqual(placeholders(FormsTranslation.de[key]));
    }
  });

  it('aliases the other languages to English', () => {
    expect(FormsTranslation.fr).toBe(FormsTranslation.en);
  });
});
