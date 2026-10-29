jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: { document: '' } }));

import { toCachedMember, trimEntries } from './offlineCache';

describe('trimEntries', () => {
  it('keeps the newest entries by savedAt', () => {
    const entries = Object.fromEntries([1, 2, 3, 4].map((n) => [`k${n}`, { savedAt: `2026-10-0${n}T00:00:00Z`, payload: n }]));
    expect(Object.keys(trimEntries(entries, 2)).sort()).toEqual(['k3', 'k4']);
  });
});

describe('toCachedMember', () => {
  it('drops contact data, birth date, address, signed photo URL and permissions', () => {
    const full = {
      id: 'm1', memberId: 'a', userId: 'u', hasAccount: true, name: 'Anna', status: 'aktiv', effectiveStatus: 'aktiv', category: 'voll',
      categoryId: 'c', categoryName: 'Vollmitglied', categoryObject: null, joinedAt: '2020-01-01', leftAt: null, orgRole: 'member', roles: [], departments: [],
      email: 'a@x.de', phone: '123', birthDate: '1990-01-01', street: 'Weg 1', photoUrl: 'https://signed', permissions: ['members:write'], emergencyContactPhone: '9',
    };
    const cached = toCachedMember(full) as Record<string, unknown>;
    expect(cached.name).toBe('Anna');
    for (const key of ['email', 'phone', 'birthDate', 'street', 'photoUrl', 'permissions', 'emergencyContactPhone']) expect(cached).not.toHaveProperty(key);
  });
});
