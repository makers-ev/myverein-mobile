export type WifiQrSecurity = 'open' | 'wpa' | 'wep' | 'wpa3';

// `;`, `,`, `"`, `:` and `\` are backslash-escaped so they can't terminate a field early.
// An all-hex value would be read as a raw hex SSID/key by scanners, so it is quoted (same as the backend).
function escapeWifiField(value: string): string {
  const escaped = value.replace(/([\\;,":])/g, '\\$1');
  return /^[0-9a-fA-F]+$/.test(value) ? `"${escaped}"` : escaped;
}

/**
 * Local fallback for the backend's `qrPayload` (identical format):
 * `WIFI:T:<WPA|WEP|SAE|nopass>;S:<ssid>;P:<password>;;`. WPA3 is `SAE`; an open network carries no password.
 * Without an explicit `security` it is derived from the password (empty = open, else WPA).
 */
export function buildWifiQrPayload(ssid: string, password: string, security?: WifiQrSecurity): string {
  const sec = security ?? (password ? 'wpa' : 'open');
  const s = escapeWifiField(ssid);
  if (sec === 'open') return `WIFI:T:nopass;S:${s};;`;
  const type = sec === 'wep' ? 'WEP' : sec === 'wpa3' ? 'SAE' : 'WPA';
  return `WIFI:T:${type};S:${s};P:${escapeWifiField(password)};;`;
}
