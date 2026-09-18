import { withScheme } from './withScheme';

// Regression test: EXPO_PUBLIC_STATUS_PAGE_URL/EXPO_PUBLIC_ERROR_REPORT_URL
// configured as a bare domain ("status.example.com") crashes Linking.openURL
// on Android with a native "No Activity found to handle Intent" error
// instead of a JS-catchable one.
describe('withScheme', () => {
  it('leaves an absolute URL untouched', () => {
    expect(withScheme('https://status.example.com')).toBe('https://status.example.com');
    expect(withScheme('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('defaults a bare domain to https://', () => {
    expect(withScheme('status.example.com')).toBe('https://status.example.com');
    expect(withScheme('example.com/contact')).toBe('https://example.com/contact');
  });
});
