import { buildWifiQrPayload } from './wifiQr';

describe('buildWifiQrPayload', () => {
  it('builds the standard WIFI: payload for plain ssid/password', () => {
    expect(buildWifiQrPayload('MyNetwork', 'secret123')).toBe('WIFI:S:MyNetwork;T:WPA;P:secret123;;');
  });

  it('escapes semicolons in the ssid and password', () => {
    expect(buildWifiQrPayload('a;b', 'c;d')).toBe('WIFI:S:a\\;b;T:WPA;P:c\\;d;;');
  });

  it('escapes commas', () => {
    expect(buildWifiQrPayload('a,b', 'c,d')).toBe('WIFI:S:a\\,b;T:WPA;P:c\\,d;;');
  });

  it('escapes double quotes', () => {
    expect(buildWifiQrPayload('a"b', 'c"d')).toBe('WIFI:S:a\\"b;T:WPA;P:c\\"d;;');
  });

  it('escapes backslashes', () => {
    expect(buildWifiQrPayload('a\\b', 'c\\d')).toBe('WIFI:S:a\\\\b;T:WPA;P:c\\\\d;;');
  });

  it('escapes a mix of special characters without double-escaping', () => {
    expect(buildWifiQrPayload('Guest;Net,"1"', 'p\\a;s,s"w')).toBe(
      'WIFI:S:Guest\\;Net\\,\\"1\\";T:WPA;P:p\\\\a\\;s\\,s\\"w;;',
    );
  });

  it('leaves an empty password escaped consistently', () => {
    expect(buildWifiQrPayload('Open', '')).toBe('WIFI:S:Open;T:WPA;P:;;');
  });
});
