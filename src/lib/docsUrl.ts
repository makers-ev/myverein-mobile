import { Linking } from 'react-native';

import { withScheme } from './withScheme';

/** Default docs portal; override with EXPO_PUBLIC_DOCS_URL (see README Configuration). */
export const DEFAULT_DOCS_URL = 'https://docs.myverein.de';

/** Pages of the docs portal (content/de) the app links to. */
export const DOCS_PATHS = {
  setup: 'verein-aufsetzen',
  calendar: 'handbuch/termine-und-anwesenheit',
  members: 'handbuch/mitglieder',
  places: 'handbuch/material-und-orte',
  faq: 'faq-und-fehlerbehebung',
} as const;

/** Absolute URL of a docs page: `<base>/de/<path>`. Base without trailing slash, path without leading slash. */
export function docsUrl(path = ''): string {
  const raw = process.env.EXPO_PUBLIC_DOCS_URL?.trim();
  const base = withScheme(raw || DEFAULT_DOCS_URL).replace(/\/+$/, '');
  const clean = path.replace(/^\/+|\/+$/g, '');
  return clean ? `${base}/de/${clean}` : `${base}/de`;
}

/** Opens a docs page in the external browser. Resolves true on success, false when no app could open it (never throws). */
export async function openDocs(path = ''): Promise<boolean> {
  try {
    await Linking.openURL(docsUrl(path));
    return true;
  } catch {
    return false;
  }
}
