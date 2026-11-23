const mem: Record<string, string> = {};
jest.mock('@/lib/appStorage', () => ({
  asyncStore: {
    getItem: async (k: string) => (k in mem ? mem[k] : null),
    setItem: async (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: async (k: string) => {
      delete mem[k];
    },
  },
}));

import { dismissSetupChecklist, getDismissedSetupClubs, restoreSetupChecklist } from './setupChecklistStorage';

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
});

describe('setup checklist storage', () => {
  it('starts empty', async () => {
    expect(await getDismissedSetupClubs()).toEqual([]);
  });
  it('remembers a hidden club once and keeps the others', async () => {
    await dismissSetupChecklist('c1');
    await dismissSetupChecklist('c1');
    await dismissSetupChecklist('c2');
    expect(await getDismissedSetupClubs()).toEqual(['c1', 'c2']);
  });
  it('restores one club', async () => {
    await dismissSetupChecklist('c1');
    await dismissSetupChecklist('c2');
    await restoreSetupChecklist('c1');
    expect(await getDismissedSetupClubs()).toEqual(['c2']);
  });
  it('survives corrupt data', async () => {
    mem['myverein.setup-checklist-dismissed'] = '{nope';
    expect(await getDismissedSetupClubs()).toEqual([]);
  });
});
