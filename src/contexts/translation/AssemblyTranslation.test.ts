import AssemblyTranslation from './AssemblyTranslation';

describe('AssemblyTranslation', () => {
  it('has the same keys in German and English', () => {
    expect(Object.keys(AssemblyTranslation.de).sort()).toEqual(Object.keys(AssemblyTranslation.en).sort());
  });
});
