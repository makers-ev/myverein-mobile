import { canOnEvent, canTrackTime, inEventScope } from './eventRights';

const role = (roleType: string, departmentId: string | null = null, termEndsAt: string | null = null) => ({ id: 'r', roleType, departmentId, termEndsAt });
const NOW = new Date('2026-06-01T10:00:00Z');

describe('inEventScope', () => {
  it('denies without membership or roles', () => {
    expect(inEventScope(null, 'd1', NOW)).toBe(false);
    expect(inEventScope({ roles: [] }, 'd1', NOW)).toBe(false);
    expect(inEventScope({ roles: [role('mitglied')] }, null, NOW)).toBe(false);
  });
  it('lets the board act club-wide, also on club-wide calendars', () => {
    expect(inEventScope({ roles: [role('vorsitz')] }, 'd1', NOW)).toBe(true);
    expect(inEventScope({ roles: [role('stellv_vorsitz')] }, null, NOW)).toBe(true);
  });
  it('limits trainers and Abteilungsleitung to their own department', () => {
    const trainer = { roles: [role('trainer', 'd1')] };
    expect(inEventScope(trainer, 'd1', NOW)).toBe(true);
    expect(inEventScope(trainer, 'd2', NOW)).toBe(false);
    expect(inEventScope(trainer, null, NOW)).toBe(false);
    expect(inEventScope({ roles: [role('abteilungsleitung', 'd2')] }, 'd2', NOW)).toBe(true);
  });
  it('ignores a role whose term has ended', () => {
    expect(inEventScope({ roles: [role('trainer', 'd1', '2026-05-01')] }, 'd1', NOW)).toBe(false);
    expect(inEventScope({ roles: [role('trainer', 'd1', '2026-07-01')] }, 'd1', NOW)).toBe(true);
  });
});

describe('canOnEvent', () => {
  it('needs the permission in addition to the scope', () => {
    const trainer = { roles: [role('trainer', 'd1')], permissions: ['attendance:write'] };
    expect(canOnEvent('attendance:write', trainer, 'd1', NOW)).toBe(true);
    expect(canOnEvent('helpers:write', trainer, 'd1', NOW)).toBe(false);
    expect(canOnEvent('attendance:write', trainer, 'd2', NOW)).toBe(false);
    expect(canOnEvent('attendance:write', { roles: [role('vorsitz')], permissions: [] }, 'd1', NOW)).toBe(false);
  });
});

describe('canTrackTime', () => {
  it('is offered to trainers, Abteilungsleitung and time:write holders only', () => {
    expect(canTrackTime(null, NOW)).toBe(false);
    expect(canTrackTime({ roles: [role('mitglied')], permissions: [] }, NOW)).toBe(false);
    expect(canTrackTime({ roles: [role('trainer', 'd1')], permissions: [] }, NOW)).toBe(true);
    expect(canTrackTime({ roles: [], permissions: ['time:write'] }, NOW)).toBe(true);
    expect(canTrackTime({ roles: [role('trainer', 'd1', '2026-01-01')], permissions: [] }, NOW)).toBe(false);
  });
});
