// `Linking.openURL` needs an absolute URI -- a bare domain like
// "status.example.com" (no scheme) fails on Android with a native
// "No Activity found to handle Intent" error instead of a JS-catchable one.
// Defaults a missing scheme to https:// rather than trusting every .env to
// get this right. Kept out of ConnectionErrorScreen.tsx (a real RN
// component) so it can be unit-tested without pulling in the RN/AsyncStorage
// dependency chain.
export function withScheme(url: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}
