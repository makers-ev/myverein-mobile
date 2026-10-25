import EventsTranslation from './EventsTranslation';

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('EventsTranslation', () => {
  it('has the same keys in German and English', () => {
    expect(Object.keys(EventsTranslation.en).sort()).toEqual(Object.keys(EventsTranslation.de).sort());
  });

  it('uses the same placeholders in both languages and has no empty texts', () => {
    for (const key of Object.keys(EventsTranslation.de)) {
      expect(EventsTranslation.de[key]).not.toBe('');
      expect(EventsTranslation.en[key]).not.toBe('');
      expect(placeholders(EventsTranslation.en[key])).toEqual(placeholders(EventsTranslation.de[key]));
    }
  });
});
