jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));

import { ApiError } from './api';
import {
  audienceKey,
  canToggleModule,
  type CatalogGroup,
  type CatalogModule,
  catalogPath,
  groupModules,
  isCustomized,
  modulePath,
  profileModuleErrorKey,
} from './profileModules';

const mod = (extra: Partial<CatalogModule> = {}): CatalogModule => ({
  id: 'mod_a',
  group: 'g1',
  label: 'A',
  description: '',
  helpText: null,
  type: 'text',
  visibleTo: 'funktionstraeger',
  editableBy: 'self',
  sensitive: false,
  mandatory: false,
  neverMandatoryGroup: false,
  state: 'inactive',
  fieldId: null,
  customized: false,
  ...extra,
});

describe('paths', () => {
  it('sends club and language, encoded', () => {
    expect(catalogPath('c 1', 'en')).toBe('/member-fields/catalog?clubId=c%201&lang=en');
    expect(modulePath('c1', 'mod_x', 'deactivate', 'de')).toBe('/member-fields/catalog/mod_x/deactivate?clubId=c1&lang=de');
  });
});

describe('groupModules', () => {
  it('keeps catalog order and drops empty groups', () => {
    const groups: CatalogGroup[] = [
      { id: 'g1', label: 'One' },
      { id: 'g2', label: 'Two' },
    ];
    const res = groupModules(groups, [mod({ id: 'a' }), mod({ id: 'b', group: 'unknown' }), mod({ id: 'c' })]);
    expect(res).toHaveLength(1);
    expect(res[0].modules.map((m) => m.id)).toEqual(['a', 'c']);
  });
});

describe('canToggleModule', () => {
  const caps = (...p: string[]) => (x: 'forms:write' | 'members:read_sensitive') => p.includes(x);
  it('denies without forms:write', () => {
    expect(canToggleModule(mod(), caps())).toEqual({ allowed: false, reason: 'forms' });
  });
  it('allows normal modules with forms:write only', () => {
    expect(canToggleModule(mod(), caps('forms:write'))).toEqual({ allowed: true, reason: null });
  });
  it('needs members:read_sensitive for sensitive modules', () => {
    expect(canToggleModule(mod({ sensitive: true }), caps('forms:write'))).toEqual({ allowed: false, reason: 'sensitive' });
    expect(canToggleModule(mod({ sensitive: true }), caps('forms:write', 'members:read_sensitive')).allowed).toBe(true);
  });
});

describe('chips', () => {
  it('shows "customised" only for existing modules', () => {
    expect(isCustomized(mod({ customized: true, state: 'active' }))).toBe(true);
    expect(isCustomized(mod({ customized: true, state: 'inactive' }))).toBe(false);
  });
  it('lets sensitive win over visibility', () => {
    expect(audienceKey(mod({ sensitive: true, visibleTo: 'vorstand' }))).toBe('forms.pm.audience.sensitive');
    expect(audienceKey(mod({ visibleTo: 'funktionstraeger' }))).toBe('forms.pm.audience.funktionstraeger');
  });
});

describe('profileModuleErrorKey', () => {
  it('maps the limit, 403, 404 and 429', () => {
    expect(profileModuleErrorKey(new ApiError(409, 'CONFLICT', 'x', { code: 'custom_field_limit', limit: 100 }))).toBe('forms.pm.err.limit');
    expect(profileModuleErrorKey(new ApiError(403, 'FORBIDDEN', 'Missing members:read_sensitive permission'))).toBe('forms.pm.err.needsSensitive');
    expect(profileModuleErrorKey(new ApiError(403, 'FORBIDDEN', 'nope'))).toBe('forms.pm.err.forbidden');
    expect(profileModuleErrorKey(new ApiError(404, 'NOT_FOUND', 'x'))).toBe('forms.pm.err.notFound');
    expect(profileModuleErrorKey(new ApiError(429, 'TOO_MANY_REQUESTS', 'x'))).toBe('api.error.rate-limit');
  });
  it('falls back to the generic mapping', () => {
    expect(profileModuleErrorKey(new ApiError(500, 'X', 'x'))).toBe('api.error.server');
    expect(profileModuleErrorKey(new Error('offline'))).toBe('alert.general-error-description');
  });
});
