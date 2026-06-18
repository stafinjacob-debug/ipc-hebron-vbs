/** Mirrors web `UserRole`; used for UI gating only (server enforces truth). */
export type AppRole = string;

export function isTeacherRole(role: AppRole | undefined): boolean {
  return role === 'TEACHER';
}

/** Check-in desk (scan, lookup, badge print) — not for teachers. */
export function canUseCheckInDesk(role: AppRole | undefined): boolean {
  if (!role) return false;
  if (isTeacherRole(role)) return false;
  return (
    role === 'SUPER_ADMIN' ||
    role === 'CHURCH_ADMIN' ||
    role === 'REGISTRATION_MANAGER' ||
    role === 'CHECK_IN_VOLUNTEER'
  );
}

/** Class roster tab — teachers and check-in staff. */
export function canViewClassRoster(role: AppRole | undefined): boolean {
  if (!role) return false;
  return canUseCheckInDesk(role) || isTeacherRole(role);
}

export function isAdminLikeRole(role: AppRole | undefined): boolean {
  if (!role) return false;
  return (
    role === 'SUPER_ADMIN' ||
    role === 'CHURCH_ADMIN' ||
    role === 'REGISTRATION_MANAGER'
  );
}

export function isSuperAdmin(role: AppRole | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** Matches server `canManageSeasonAnnouncements` (includes content managers). */
export function canManageAnnouncements(role: AppRole | undefined): boolean {
  if (!role) return false;
  return (
    role === 'SUPER_ADMIN' ||
    role === 'CHURCH_ADMIN' ||
    role === 'REGISTRATION_MANAGER' ||
    role === 'CONTENT_MANAGER'
  );
}

export function roleLabel(role: AppRole | undefined): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Admin';
    case 'CHURCH_ADMIN':
      return 'Church admin';
    case 'REGISTRATION_MANAGER':
      return 'Registration';
    case 'CHECK_IN_VOLUNTEER':
      return 'Check-in volunteer';
    case 'TEACHER':
      return 'Teacher / leader';
    default:
      return role?.replace(/_/g, ' ') ?? 'Staff';
  }
}
