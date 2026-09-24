// Standard WiFi QR payload: `WIFI:S:<ssid>;T:WPA;P:<password>;;`.
// `;`, `,`, `"`, `:` and `\` are backslash-escaped so they can't terminate a field early.
function escapeWifiField(value: string): string {
  return value.replace(/([\\;,":])/g, '\\$1');
}

/** Builds a scannable WiFi QR payload; an empty password yields an open (`T:nopass`) network. */
export function buildWifiQrPayload(ssid: string, password: string): string {
  if (!password) return `WIFI:S:${escapeWifiField(ssid)};T:nopass;;`;
  return `WIFI:S:${escapeWifiField(ssid)};T:WPA;P:${escapeWifiField(password)};;`;
}
