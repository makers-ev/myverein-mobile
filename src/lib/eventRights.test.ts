import { canOnEvent, canSeeTeamHours, canTrackTime, inEventScope } from './eventRights';

const role = (roleType: string, departmentId: string | null = null, termEndsAt: string | null = null) => ({ id: 'r', roleType, departmentId, termEndsAt });
const NOW = new Date('2026-06-01T10:00:00Z');

describe('inEventScope', () => {
  it('denies without membership or roles', () => {
    expect(inEventScope(null, 'attendance:write', 'd1', NOW)).toBe(false);
    expect(inEventScope({ roles: [] }, 'attendance:write', 'd1', NOW)).toBe(false);
    expect(inEventScope({ roles: [role('mitglied')] }, 'attendance:write', null, NOW)).toBe(false);
  });
  it('lets the board act club-wide, also on club-wide calendars', () => {
    expect(inEventScope({ roles: [role('vorsitz')] }, 'attendance:write', 'd1', NOW)).toBe(true);
    expect(inEventScope({ roles: [role('stellv_vorsitz')] }, 'attendance:write', null, NOW)).toBe(true);
  });
  it('limits trainers and Abteilungsleitung to their own department', () => {
    const trainer = { roles: [role('trainer', 'd1')] };
    expect(inEventScope(trainer, 'attendance:write', 'd1', NOW)).toBe(true);
    expect(inEventScope(trainer, 'attendance:write', 'd2', NOW)).toBe(false);
    expect(inEventScope(trainer, 'attendance:write', null, NOW)).toBe(false);
    expect(inEventScope({ roles: [role('abteilungsleitung', 'd2')] }, 'attendance:write', 'd2', NOW)).toBe(true);
  });
  it('ignores a role whose term has ended', () => {
    expect(inEventScope({ roles: [role('trainer', 'd1', '2026-05-01')] }, 'attendance:write', 'd1', NOW)).toBe(false);
    expect(inEventScope({ roles: [role('trainer', 'd1', '2026-07-01')] }, 'attendance:write', 'd1', NOW)).toBe(true);
  });
});

describe('per-permission club-wide table', () => {
  it('does not let a role that lacks the permission make the caller club-wide', () => {
    const mixed = { roles: [role('schriftfuehrer'), role('trainer', 'd1')] };
    expect(inEventScope(mixed, 'helpers:write', 'd2', NOW)).toBe(true);
    expect(inEventScope(mixed, 'attendance:write', 'd2', NOW)).toBe(false);
    expect(inEventScope(mixed, 'attendance:write', 'd1', NOW)).toBe(true);
    expect(inEventScope({ roles: [role('kassenwart')] }, 'helpers:write', null, NOW)).toBe(false);
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

describe('canTrackTime with canTrack from the server', () => {
  it('follows canTrack when delivered', () => {
    expect(canTrackTime({ roles: [role('mitglied')], permissions: [], canTrack: true }, NOW)).toBe(true);
    expect(canTrackTime({ roles: [role('trainer', 'd1')], permissions: ['time:write'], canTrack: false }, NOW)).toBe(false);
    expect(canTrackTime({ roles: [], permissions: [], canTrack: false }, NOW)).toBe(false);
  });
});

describe('canSeeTeamHours', () => {
  it('needs time:write or time:read_rates', () => {
    expect(canSeeTeamHours(null)).toBe(false);
    expect(canSeeTeamHours({ permissions: [] })).toBe(false);
    expect(canSeeTeamHours({ permissions: ['time:write'] })).toBe(true);
    expect(canSeeTeamHours({ permissions: ['time:read_rates'] })).toBe(true);
  });
});
