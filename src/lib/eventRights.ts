import type { ClubMember } from '@/hooks/useClubMembers';

/**
 * Wave 12 B9 gating helpers. The backend is the authority (department scope, `403`); these only decide which
 * buttons are offered, deny by default: no membership, no role, no match -> not offered.
 *
 * Board roles act club-wide; `trainer` / `abteilungsleitung` hold the event permissions only for events whose
 * calendar belongs to one of the departments of their (currently effective) department-bound role.
 */
/**
 * Roles that hold a permission CLUB-WIDE (mirrors the backend's `hasClubWidePermission`: a non-department role that grants
 * the permission). A role that does not grant this permission never makes the caller club-wide for it.
 */
const BOARD = ['vorsitz', 'stellv_vorsitz'];
const CLUB_WIDE_BY_PERMISSION: Record<string, readonly string[]> = {
  'attendance:write': BOARD,
  'attendance:read': BOARD,
  'registrations:read': BOARD,
  'time:write': BOARD,
  'helpers:write': [...BOARD, 'schriftfuehrer'],
  'time:read_rates': [...BOARD, 'kassenwart'],
};
const DEPARTMENT_ROLES: readonly string[] = ['trainer', 'abteilungsleitung'];

type RoleLike = { roleType: string; departmentId: string | null; termEndsAt: string | null };

function effectiveRoles(member: Pick<ClubMember, 'roles'> | null | undefined, now: Date): RoleLike[] {
  return (member?.roles ?? []).filter((r) => !r.termEndsAt || new Date(r.termEndsAt).getTime() >= now.getTime());
}

/** Is the caller allowed to act on an event of a calendar of `calendarDepartmentId` (`null` = club-wide calendar)? */
export function inEventScope(
  member: Pick<ClubMember, 'roles'> | null | undefined,
  permission: string,
  calendarDepartmentId: string | null,
  now = new Date(),
): boolean {
  const roles = effectiveRoles(member, now);
  const wide = CLUB_WIDE_BY_PERMISSION[permission] ?? [];
  if (roles.some((r) => wide.includes(r.roleType))) return true;
  if (!calendarDepartmentId) return false;
  return roles.some((r) => DEPARTMENT_ROLES.includes(r.roleType) && r.departmentId === calendarDepartmentId);
}

/** Permission held AND event in scope. */
export function canOnEvent(
  permission: string,
  member: Pick<ClubMember, 'roles' | 'permissions'> | null | undefined,
  calendarDepartmentId: string | null,
  now = new Date(),
): boolean {
  return !!member?.permissions?.includes(permission) && inEventScope(member, permission, calendarDepartmentId, now);
}

/**
 * Time tracking (stamp, manual entry, from-event) is offered when the server says `canTrack` on `/club-members/me`
 * (club member with an applicable hourly rate, trainer, Abteilungsleitung or `time:write`). Deny by default: a missing
 * membership never offers it. Only an older backend that does not deliver the field yet falls back to the former role rule.
 */
export function canTrackTime(member: Pick<ClubMember, 'roles' | 'permissions' | 'canTrack'> | null | undefined, now = new Date()): boolean {
  if (!member) return false;
  if (typeof member.canTrack === 'boolean') return member.canTrack;
  if (member.permissions?.includes('time:write')) return true;
  return effectiveRoles(member, now).some((r) => DEPARTMENT_ROLES.includes(r.roleType));
}

/** The team overview (`GET /time-report`) is offered to `time:write` and `time:read_rates` holders; the server scopes it. */
export function canSeeTeamHours(member: Pick<ClubMember, 'permissions'> | null | undefined): boolean {
  return !!member?.permissions?.some((p) => p === 'time:write' || p === 'time:read_rates');
}
