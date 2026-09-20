// Standard WiFi QR-code payload format (`WIFI:S:<ssid>;T:WPA;P:<password>;;`),
// see the Wave 3 Implementation Plan's "Open Points" section. `;`, `,`, `"`
// and `\` inside the ssid/password are backslash-escaped per the format's
// own spec -- a `;` inside an unescaped SSID would otherwise terminate the
// field early and corrupt the payload.
function escapeWifiField(value: string): string {
  return value.replace(/([\\;,"])/g, '\\$1');
}

/** Builds a scannable WiFi QR-code payload from a network's ssid/password. */
export function buildWifiQrPayload(ssid: string, password: string): string {
  return `WIFI:S:${escapeWifiField(ssid)};T:WPA;P:${escapeWifiField(password)};;`;
}
