/** Mirrors web `UserRole`; used for UI gating only (server enforces truth). */
export type AppRole = string;

export function isAdminLikeRole(role: AppRole | undefined): boolean {
  if (!role) return false;
  return (
    role === 'SUPER_ADMIN' ||
    role === 'CHURCH_ADMIN' ||
    role === 'REGISTRATION_MANAGER'
  );
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
