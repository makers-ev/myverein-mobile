/**
 * Normalises a list payload to an array: accepts a bare array or the backend envelope `{ data: [...] }`; anything else
 * (undefined, null, object without an array `data`) yields `null` so the caller can treat it as an error instead of crashing.
 */
export function unwrapList<T>(payload: unknown): T[] | null {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }
  return null;
}
