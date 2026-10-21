import PrivacyTranslation from './PrivacyTranslation';

describe('PrivacyTranslation', () => {
  it('has the same keys in German and English', () => {
    expect(Object.keys(PrivacyTranslation.de).sort()).toEqual(Object.keys(PrivacyTranslation.en).sort());
  });

  it('never calls a consent mandatory (Koppelungsverbot): consents are voluntary', () => {
    const consentTexts = Object.entries({ ...PrivacyTranslation.de, ...PrivacyTranslation.en }).filter(([k]) => k.startsWith('consent.'));
    expect(consentTexts.length).toBeGreaterThan(10);
    for (const [key, text] of consentTexts) {
      expect({ key, hit: /pflicht|verpflichtend|zwingend|mandatory|required|obligatory/i.test(text) }).toEqual({ key, hit: false });
    }
    expect(PrivacyTranslation.de['consent.title']).toMatch(/freiwillig/);
    expect(PrivacyTranslation.en['consent.title']).toMatch(/voluntary/);
  });
});
