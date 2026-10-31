import { Linking } from 'react-native';

import { docsUrl, openDocs } from './docsUrl';

describe('docsUrl', () => {
  const original = process.env.EXPO_PUBLIC_DOCS_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_DOCS_URL;
    else process.env.EXPO_PUBLIC_DOCS_URL = original;
    jest.restoreAllMocks();
  });

  it('uses the default portal and the /de prefix', () => {
    delete process.env.EXPO_PUBLIC_DOCS_URL;
    expect(docsUrl('handbuch/mitglieder')).toBe('https://docs.myverein.de/de/handbuch/mitglieder');
    expect(docsUrl()).toBe('https://docs.myverein.de/de');
  });

  it('honours the env override, adds a missing scheme and trims slashes', () => {
    process.env.EXPO_PUBLIC_DOCS_URL = 'docs.example.org/';
    expect(docsUrl('/verein-aufsetzen/')).toBe('https://docs.example.org/de/verein-aufsetzen');
  });

  it('falls back to the default for a blank value', () => {
    process.env.EXPO_PUBLIC_DOCS_URL = '  ';
    expect(docsUrl('faq-und-fehlerbehebung')).toBe('https://docs.myverein.de/de/faq-und-fehlerbehebung');
  });

  it('opens the URL externally and reports success', async () => {
    delete process.env.EXPO_PUBLIC_DOCS_URL;
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await expect(openDocs('handbuch/mitglieder')).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith('https://docs.myverein.de/de/handbuch/mitglieder');
  });

  it('returns false instead of throwing when opening fails', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No Activity found'));
    await expect(openDocs('x')).resolves.toBe(false);
  });
});
