import type { UserRole } from "@/generated/prisma";

/** Map pre-migration JWT / stale values to current `UserRole` enum. */
export function normalizeStaffRole(role: string | UserRole): UserRole {
  switch (role as string) {
    case "ADMIN":
      return "SUPER_ADMIN";
    case "COORDINATOR":
      return "CHURCH_ADMIN";
    case "VOLUNTEER":
      return "CHECK_IN_VOLUNTEER";
    default:
      return role as UserRole;
  }
}

/** Anyone who may use the staff shell (sidebar); excludes PARENT. */
export function isStaffRole(role: UserRole | string): boolean {
  return normalizeStaffRole(role) !== "PARENT";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "CHURCH_ADMIN";
}

/** Registrations, forms, staff-entered enrollment, submission edits. */
export function canManageDirectory(role: UserRole): boolean {
  return (
    role === "SUPER_ADMIN" || role === "CHURCH_ADMIN" || role === "REGISTRATION_MANAGER"
  );
}

/** Legacy name: staff who see operations modules (not content-only / reports-only narrow shells). */
export function canViewOperations(role: UserRole): boolean {
  return isStaffRole(role);
}

export function canSeeMainNavLink(role: UserRole | string, href: string): boolean {
  const r = normalizeStaffRole(role);
  if (r === "PARENT") return false;
  if (r === "SUPER_ADMIN" || r === "CHURCH_ADMIN") return true;

  if (r === "CONTENT_MANAGER") {
    return (
      href === "/dashboard" ||
      href.startsWith("/content") ||
      href.startsWith("/settings")
    );
  }
  if (r === "REPORTS_VIEWER") {
    return (
      href === "/dashboard" ||
      href.startsWith("/reports") ||
      href.startsWith("/settings")
    );
  }
  if (r === "CHECK_IN_VOLUNTEER") {
    return (
      href === "/dashboard" ||
      href.startsWith("/check-in") ||
      href.startsWith("/settings")
    );
  }
  if (r === "TEACHER") {
    return (
      href === "/dashboard" ||
      href.startsWith("/registrations") ||
      href.startsWith("/students") ||
      href.startsWith("/classes") ||
      href.startsWith("/check-in") ||
      href.startsWith("/content") ||
      href.startsWith("/settings")
    );
  }
  if (r === "REGISTRATION_MANAGER") {
    return (
      href === "/dashboard" ||
      href.startsWith("/registrations") ||
      href.startsWith("/students") ||
      href.startsWith("/classes") ||
      href.startsWith("/check-in") ||
      href.startsWith("/content") ||
      href.startsWith("/reports") ||
      href.startsWith("/settings")
    );
  }
  /* Signed-in non-parent with an unknown role value: show full nav instead of a blank sidebar. */
  return true;
}

export function canUseCheckInActions(role: UserRole): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "CHURCH_ADMIN" ||
    role === "REGISTRATION_MANAGER" ||
    role === "CHECK_IN_VOLUNTEER" ||
    role === "TEACHER"
  );
}

export function canManageVolunteersModule(role: UserRole): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "CHURCH_ADMIN" ||
    role === "REGISTRATION_MANAGER"
  );
}
