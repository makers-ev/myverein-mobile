import DocumentsTranslation from './DocumentsTranslation';

describe('DocumentsTranslation', () => {
  it('has the same keys in German and English', () => {
    expect(Object.keys(DocumentsTranslation.de).sort()).toEqual(Object.keys(DocumentsTranslation.en).sort());
  });
});
