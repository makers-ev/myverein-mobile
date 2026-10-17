import { ApiError } from './api';
import { apiErrorKey } from './apiErrorMessage';
import { type ContentLang, type EditableBy, type TextTranslations, type VisibleTo } from './customFields';

/**
 * Pure helpers of the profile module catalog ("Bausteine", backend `GET /member-fields/catalog`): types of the response,
 * grouping, the rule who may switch a module and the mapping of the server's errors onto translation keys. The server is the
 * authority for every right; the app only disables what it knows would be refused (deny by default).
 */

export type ModuleState = 'active' | 'archived' | 'inactive';

export interface CatalogGroup {
  id: string;
  label: string;
  translations?: Partial<Record<ContentLang, { label?: string | null }>> | null;
}

export interface CatalogModule {
  id: string;
  group: string;
  label: string;
  description: string;
  helpText: string | null;
  translations?: TextTranslations;
  type: string;
  visibleTo: VisibleTo;
  editableBy: EditableBy;
  sensitive: boolean;
  mandatory: false;
  neverMandatoryGroup: boolean;
  state: ModuleState;
  fieldId: string | null;
  /** The board changed the definition after activation. */
  customized: boolean;
}

export interface CatalogResponse {
  data: {
    lang: string;
    groups: CatalogGroup[];
    modules: CatalogModule[];
    limit: { used: number; max: number };
  };
}

export interface ModuleGroupSection {
  group: CatalogGroup;
  modules: CatalogModule[];
}

/** Modules by group in catalog order; groups without modules and modules of unknown groups are dropped. */
export function groupModules(groups: readonly CatalogGroup[], modules: readonly CatalogModule[]): ModuleGroupSection[] {
  return groups
    .map((group) => ({ group, modules: modules.filter((m) => m.group === group.id) }))
    .filter((s) => s.modules.length > 0);
}

/** Query path of the catalog: the display language goes to the server (`?lang=de|en`). */
export const catalogPath = (clubId: string, lang: ContentLang): string => `/member-fields/catalog?clubId=${encodeURIComponent(clubId)}&lang=${lang}`;

export const modulePath = (clubId: string, moduleId: string, action: 'activate' | 'deactivate', lang: ContentLang): string =>
  `/member-fields/catalog/${encodeURIComponent(moduleId)}/${action}?clubId=${encodeURIComponent(clubId)}&lang=${lang}`;

/**
 * Whether the caller may switch this module. `forms:write` is the base right; sensitive modules (Kinderschutz) need
 * `members:read_sensitive` for BOTH activate and deactivate. `reason` explains a disabled switch.
 */
export function canToggleModule(
  module: Pick<CatalogModule, 'sensitive'>,
  can: (permission: 'forms:write' | 'members:read_sensitive') => boolean,
): { allowed: boolean; reason: 'forms' | 'sensitive' | null } {
  if (!can('forms:write')) return { allowed: false, reason: 'forms' };
  if (module.sensitive && !can('members:read_sensitive')) return { allowed: false, reason: 'sensitive' };
  return { allowed: true, reason: null };
}

/** The "Angepasst" chip only makes sense for a module that exists (active or archived). */
export const isCustomized = (m: Pick<CatalogModule, 'state' | 'customized'>): boolean => m.customized && m.state !== 'inactive';

/** Translation key of the audience chip: who sees the values. Sensitive wins (only holders of `members:read_sensitive`). */
export function audienceKey(m: Pick<CatalogModule, 'sensitive' | 'visibleTo'>): string {
  if (m.sensitive) return 'forms.pm.audience.sensitive';
  return `forms.pm.audience.${m.visibleTo}`;
}

const detailsCode = (err: ApiError): string | undefined => (err.details as { code?: unknown } | undefined)?.code as string | undefined;

/** Translation key for a failed catalog request; server messages never reach the UI. */
export function profileModuleErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && (detailsCode(err) === 'custom_field_limit' || err.code === 'custom_field_limit')) return 'forms.pm.err.limit';
    if (err.status === 403) return /read_sensitive/i.test(err.message) ? 'forms.pm.err.needsSensitive' : 'forms.pm.err.forbidden';
    if (err.status === 404) return 'forms.pm.err.notFound';
    if (err.status === 429) return 'api.error.rate-limit';
  }
  return apiErrorKey(err);
}
