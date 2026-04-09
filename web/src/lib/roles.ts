import type { UserRole } from "@/generated/prisma";
import {
  canManageDirectory as canManageDirectoryPerm,
  canManageUsers as canManageUsersPerm,
  canViewOperations as canViewOperationsPerm,
} from "@/lib/permissions";

export {
  canManageVolunteersModule,
  canSeeMainNavLink,
  isStaffRole,
  canUseCheckInActions,
} from "@/lib/permissions";

export function canManageDirectory(role: UserRole): boolean {
  return canManageDirectoryPerm(role);
}

export function canViewOperations(role: UserRole): boolean {
  return canViewOperationsPerm(role);
}

/** Invite users, change roles, deactivate — Settings → Users & Access. */
export function canManageUsers(role: UserRole): boolean {
  return canManageUsersPerm(role);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "CHURCH_ADMIN":
      return "Church Admin";
    case "REGISTRATION_MANAGER":
      return "Registration Manager";
    case "CHECK_IN_VOLUNTEER":
      return "Check-In Volunteer";
    case "TEACHER":
      return "Teacher";
    case "CONTENT_MANAGER":
      return "Content Manager";
    case "REPORTS_VIEWER":
      return "Reports Viewer";
    case "PARENT":
      return "Parent";
    default:
      return role;
  }
}

export const ASSIGNABLE_STAFF_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "CHURCH_ADMIN",
  "REGISTRATION_MANAGER",
  "CHECK_IN_VOLUNTEER",
  "TEACHER",
  "CONTENT_MANAGER",
  "REPORTS_VIEWER",
];

/** Whether an actor may invite, edit, or deactivate a user who has (or will have) this role. */
export function canAssignRole(actorRole: UserRole, assignedOrTargetRole: UserRole): boolean {
  if (assignedOrTargetRole === "PARENT") return false;
  if (assignedOrTargetRole === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") return false;
  return ASSIGNABLE_STAFF_ROLES.includes(assignedOrTargetRole);
}

export const ROLE_HELP: Record<
  UserRole,
  { title: string; summary: string; bullets: string[] }
> = {
  SUPER_ADMIN: {
    title: "Super Admin",
    summary: "Full control of the VBS admin portal and user access.",
    bullets: [
      "All modules: registrations, classes, check-in, content, reports, settings",
      "Manage users, roles, and invitations",
      "Manage seasons and system-wide settings",
    ],
  },
  CHURCH_ADMIN: {
    title: "Church Admin",
    summary: "Day-to-day leadership for VBS without full platform ownership.",
    bullets: [
      "Registrations, classes, check-in, volunteers, and content",
      "Invite and manage most staff roles",
      "Reporting and exports",
    ],
  },
  REGISTRATION_MANAGER: {
    title: "Registration Manager",
    summary: "Focused on signup, forms, and enrollment data.",
    bullets: [
      "Public registration forms and submissions",
      "View and edit registrations, waitlist, confirmations",
      "Staff-entered registrations",
    ],
  },
  CHECK_IN_VOLUNTEER: {
    title: "Check-In Volunteer",
    summary: "Front desk / arrival workflow only.",
    bullets: [
      "Check-in and check-out tools",
      "Search today’s registrations",
      "No access to system settings or form builder",
    ],
  },
  TEACHER: {
    title: "Teacher",
    summary: "Classroom-facing access (rosters and attendance).",
    bullets: [
      "Assigned classes and student rosters",
      "Check-in / attendance for their group",
      "Class-related announcements",
    ],
  },
  CONTENT_MANAGER: {
    title: "Content Manager",
    summary: "Website-style content without student medical data.",
    bullets: ["Announcements and documents", "No registration or medical notes by default"],
  },
  REPORTS_VIEWER: {
    title: "Reports Viewer",
    summary: "Read-only insight into attendance and enrollment.",
    bullets: ["Reports and exports", "Cannot change registrations or settings"],
  },
  PARENT: {
    title: "Parent",
    summary: "Family portal (not used in this staff shell).",
    bullets: [],
  },
};
