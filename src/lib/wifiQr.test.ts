import { buildWifiQrPayload } from './wifiQr';

describe('buildWifiQrPayload', () => {
  it('builds the backend-identical payload for plain ssid/password', () => {
    expect(buildWifiQrPayload('MyNetwork', 'secret123')).toBe('WIFI:T:WPA;S:MyNetwork;P:secret123;;');
  });
  it('maps security types', () => {
    expect(buildWifiQrPayload('n', 'secret1', 'wep')).toBe('WIFI:T:WEP;S:n;P:secret1;;');
    expect(buildWifiQrPayload('n', 'secret1', 'wpa3')).toBe('WIFI:T:SAE;S:n;P:secret1;;');
    expect(buildWifiQrPayload('n', 'secret1', 'wpa')).toBe('WIFI:T:WPA;S:n;P:secret1;;');
  });
  it('escapes special characters without double-escaping', () => {
    expect(buildWifiQrPayload('Guest;Net,"1"', 'p\\a;s,s"w:x')).toBe('WIFI:T:WPA;S:Guest\;Net\\,\\"1\\";P:p\\\\a\;s\\,s\\"w\\:x;;');
  });
  it('quotes all-hex values like the backend', () => {
    expect(buildWifiQrPayload('abcdef', '12345678')).toBe('WIFI:T:WPA;S:"abcdef";P:"12345678";;');
  });
  it('emits an open network without P: (explicit or empty password)', () => {
    expect(buildWifiQrPayload('Open;Net', '')).toBe('WIFI:T:nopass;S:Open\;Net;;');
    expect(buildWifiQrPayload('x', 'ignored', 'open')).toBe('WIFI:T:nopass;S:x;;');
  });
});
