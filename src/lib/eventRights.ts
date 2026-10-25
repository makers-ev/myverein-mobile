import type { ClubMember } from '@/hooks/useClubMembers';

/**
 * Wave 12 B9 gating helpers. The backend is the authority (department scope, `403`); these only decide which
 * buttons are offered, deny by default: no membership, no role, no match -> not offered.
 *
 * Board roles act club-wide; `trainer` / `abteilungsleitung` hold the event permissions only for events whose
 * calendar belongs to one of the departments of their (currently effective) department-bound role.
 */
const CLUB_WIDE_ROLES: readonly string[] = ['vorsitz', 'stellv_vorsitz', 'schriftfuehrer', 'kassenwart'];
const DEPARTMENT_ROLES: readonly string[] = ['trainer', 'abteilungsleitung'];

type RoleLike = { roleType: string; departmentId: string | null; termEndsAt: string | null };

function effectiveRoles(member: Pick<ClubMember, 'roles'> | null | undefined, now: Date): RoleLike[] {
  return (member?.roles ?? []).filter((r) => !r.termEndsAt || new Date(r.termEndsAt).getTime() >= now.getTime());
}

/** Is the caller allowed to act on an event of a calendar of `calendarDepartmentId` (`null` = club-wide calendar)? */
export function inEventScope(member: Pick<ClubMember, 'roles'> | null | undefined, calendarDepartmentId: string | null, now = new Date()): boolean {
  const roles = effectiveRoles(member, now);
  if (roles.some((r) => CLUB_WIDE_ROLES.includes(r.roleType))) return true;
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
  return !!member?.permissions?.includes(permission) && inEventScope(member, calendarDepartmentId, now);
}

/** Time tracking is offered to trainers, Abteilungsleitung and `time:write` holders only (others get 403). */
export function canTrackTime(member: Pick<ClubMember, 'roles' | 'permissions'> | null | undefined, now = new Date()): boolean {
  if (!member) return false;
  if (member.permissions?.includes('time:write')) return true;
  return effectiveRoles(member, now).some((r) => DEPARTMENT_ROLES.includes(r.roleType));
}
