"use server";

import { auth } from "@/auth";
import { logStaffAccess } from "@/lib/access-audit";
import { generateInviteToken, hashInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";
import { ASSIGNABLE_STAFF_ROLES, canAssignRole, canManageUsers } from "@/lib/roles";
import type { UserRole, UserStatus } from "@/generated/prisma";
import { sendStaffInviteEmail } from "@/lib/email/send-staff-invite-email";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

export type UserMgmtState = { ok: boolean; message: string; inviteLink?: string };

async function requireManager() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role || !canManageUsers(session.user.role)) {
    return null;
  }
  return session;
}

async function countActiveSuperAdmins(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export async function inviteStaffUser(_prev: UserMgmtState | null, formData: FormData): Promise<UserMgmtState> {
  const session = await requireManager();
  if (!session) return { ok: false, message: "You do not have permission." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") as UserRole;
  const seasonIds = formData.getAll("seasonScope").map(String).filter(Boolean);
  const classroomIds = formData.getAll("classroomScope").map(String).filter(Boolean);

  if (!name || !email) return { ok: false, message: "Full name and email are required." };
  if (!ASSIGNABLE_STAFF_ROLES.includes(role)) return { ok: false, message: "Choose a valid role." };
  if (!canAssignRole(session.user.role, role)) {
    return { ok: false, message: "You cannot assign that role." };
  }

  const dup = await prisma.user.findUnique({ where: { email } });
  if (dup) return { ok: false, message: "Someone already uses that email." };

  const raw = generateInviteToken();
  const tokenHash = hashInviteToken(raw);
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role,
      status: "INVITED",
      invitedAt: new Date(),
      invitedById: session.user.id,
      inviteTokenHash: tokenHash,
      inviteExpiresAt,
      seasonScopes:
        seasonIds.length > 0
          ? { create: seasonIds.map((seasonId) => ({ seasonId })) }
          : undefined,
      classroomScopes:
        classroomIds.length > 0
          ? { create: classroomIds.map((classroomId) => ({ classroomId })) }
          : undefined,
    },
  });

  const inviteLink = `${getPublicAppBaseUrl()}/invite/${raw}`;

  const emailResult = await sendStaffInviteEmail({
    toEmail: email,
    toName: name,
    inviteLink,
    role,
    inviterDisplayName: session.user.name ?? session.user.email,
  });

  await logStaffAccess("USER_INVITED", {
    actorUserId: session.user.id,
    targetUserId: user.id,
    metadata: {
      email,
      role,
      inviteEmailSent: emailResult.mode === "sent",
      inviteEmailMode: emailResult.mode,
    },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${user.id}`);

  if (emailResult.mode === "sent") {
    return {
      ok: true,
      message: `Invitation email sent to ${email}. You can still copy the link below if they don’t receive it.`,
      inviteLink,
    };
  }
  if (emailResult.mode === "skipped_no_provider") {
    return {
      ok: true,
      message:
        "Invitation ready. Email is not configured (set Microsoft Graph env vars) — copy the link and send it securely.",
      inviteLink,
    };
  }
  const errShort =
    emailResult.error.length > 220 ? `${emailResult.error.slice(0, 220)}…` : emailResult.error;
  return {
    ok: true,
    message: `Invitation saved, but the email could not be sent: ${errShort} Copy the link below.`,
    inviteLink,
  };
}

export async function resendStaffInvite(userId: string): Promise<UserMgmtState> {
  const session = await requireManager();
  if (!session) return { ok: false, message: "Unauthorized." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "User not found." };
  if (user.status === "ACTIVE" && user.passwordHash) {
    return { ok: false, message: "This user already completed setup." };
  }
  if (user.status !== "INVITED" && user.status !== "PENDING_SETUP") {
    return { ok: false, message: "Resend is only for users who have not finished setup." };
  }
  if (!canAssignRole(session.user.role, user.role)) {
    return { ok: false, message: "You cannot manage this user’s role level." };
  }

  const raw = generateInviteToken();
  const tokenHash = hashInviteToken(raw);
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt,
      status: "INVITED",
    },
  });

  const inviteLink = `${getPublicAppBaseUrl()}/invite/${raw}`;

  const emailResult = await sendStaffInviteEmail({
    toEmail: user.email,
    toName: user.name ?? user.email,
    inviteLink,
    role: user.role,
    inviterDisplayName: session.user.name ?? session.user.email,
  });

  await logStaffAccess("INVITE_RESENT", {
    actorUserId: session.user.id,
    targetUserId: userId,
    metadata: {
      inviteEmailSent: emailResult.mode === "sent",
      inviteEmailMode: emailResult.mode,
    },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);

  if (emailResult.mode === "sent") {
    return { ok: true, message: `Invite email sent to ${user.email}.`, inviteLink };
  }
  if (emailResult.mode === "skipped_no_provider") {
    return { ok: true, message: "New invite link generated. Copy it below (email not configured).", inviteLink };
  }
  const errShort =
    emailResult.error.length > 220 ? `${emailResult.error.slice(0, 220)}…` : emailResult.error;
  return {
    ok: true,
    message: `New link generated, but email failed: ${errShort} Copy the link below.`,
    inviteLink,
  };
}

export async function updateUserRole(userId: string, nextRole: UserRole): Promise<UserMgmtState> {
  const session = await requireManager();
  if (!session) return { ok: false, message: "Unauthorized." };
  if (userId === session.user.id && nextRole !== session.user.role) {
    return { ok: false, message: "You cannot change your own role here." };
  }
  if (!ASSIGNABLE_STAFF_ROLES.includes(nextRole)) return { ok: false, message: "Invalid role." };
  if (!canAssignRole(session.user.role, nextRole)) {
    return { ok: false, message: "You cannot assign that role." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "User not found." };
  if (!canAssignRole(session.user.role, user.role)) {
    return { ok: false, message: "You cannot edit this user." };
  }

  if (user.role === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN") {
    const remaining = await countActiveSuperAdmins(userId);
    if (remaining < 1) {
      return { ok: false, message: "Keep at least one active Super Admin." };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role: nextRole } });

  await logStaffAccess("USER_ROLE_CHANGED", {
    actorUserId: session.user.id,
    targetUserId: userId,
    metadata: { from: user.role, to: nextRole },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { ok: true, message: "Role updated." };
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<UserMgmtState> {
  const session = await requireManager();
  if (!session) return { ok: false, message: "Unauthorized." };
  if (userId === session.user.id) {
    return { ok: false, message: "You cannot change your own status." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "User not found." };
  if (!canAssignRole(session.user.role, user.role)) {
    return { ok: false, message: "You cannot edit this user." };
  }

  if (user.role === "SUPER_ADMIN" && status !== "ACTIVE") {
    const remaining = await countActiveSuperAdmins(userId);
    if (remaining < 1) {
      return { ok: false, message: "You must keep at least one active Super Admin." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      deactivatedAt: status === "ACTIVE" ? null : new Date(),
    },
  });

  await logStaffAccess("USER_STATUS_CHANGED", {
    actorUserId: session.user.id,
    targetUserId: userId,
    metadata: { status },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { ok: true, message: "Status updated." };
}

export async function updateUserScopes(
  userId: string,
  seasonIds: string[],
  classroomIds: string[],
): Promise<UserMgmtState> {
  const session = await requireManager();
  if (!session) return { ok: false, message: "Unauthorized." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "User not found." };
  if (!canAssignRole(session.user.role, user.role)) {
    return { ok: false, message: "You cannot edit this user." };
  }

  await prisma.$transaction([
    prisma.userSeasonScope.deleteMany({ where: { userId } }),
    prisma.userClassroomScope.deleteMany({ where: { userId } }),
    ...(seasonIds.length
      ? [
          prisma.userSeasonScope.createMany({
            data: seasonIds.map((seasonId) => ({ userId, seasonId })),
          }),
        ]
      : []),
    ...(classroomIds.length
      ? [
          prisma.userClassroomScope.createMany({
            data: classroomIds.map((classroomId) => ({ userId, classroomId })),
          }),
        ]
      : []),
  ]);

  await logStaffAccess("USER_SCOPES_UPDATED", {
    actorUserId: session.user.id,
    targetUserId: userId,
    metadata: { seasonIds, classroomIds },
  });

  revalidatePath(`/settings/users/${userId}`);
  return { ok: true, message: "Access scope saved." };
}

export async function adminSetPassword(userId: string, newPassword: string): Promise<UserMgmtState> {
  const session = await requireManager();
  if (!session) return { ok: false, message: "Unauthorized." };
  if (session.user.role !== "SUPER_ADMIN") {
    return { ok: false, message: "Only Super Admins can set a password directly." };
  }
  if (newPassword.length < 8) return { ok: false, message: "Password must be at least 8 characters." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "User not found." };

  const passwordHash = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      status: "ACTIVE",
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });

  await logStaffAccess("USER_PASSWORD_SET_BY_ADMIN", {
    actorUserId: session.user.id,
    targetUserId: userId,
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { ok: true, message: "Password updated. Ask the user to sign in with the new password." };
}

export async function removeUserAccess(userId: string): Promise<UserMgmtState> {
  const session = await requireManager();
  if (!session) return { ok: false, message: "Unauthorized." };
  if (userId === session.user.id) {
    return { ok: false, message: "You cannot remove your own access." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "User not found." };
  if (user.role === "PARENT") {
    return { ok: false, message: "Parent accounts are not managed here." };
  }
  if (!canAssignRole(session.user.role, user.role)) {
    return { ok: false, message: "You cannot edit this user." };
  }

  if (user.role === "SUPER_ADMIN") {
    const remaining = await countActiveSuperAdmins(userId);
    if (remaining < 1) {
      return { ok: false, message: "You must keep at least one active Super Admin." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "DISABLED",
      deactivatedAt: new Date(),
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });

  await logStaffAccess("USER_ACCESS_REMOVED", {
    actorUserId: session.user.id,
    targetUserId: userId,
    metadata: { email: user.email },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { ok: true, message: "Access removed. They can no longer sign in." };
}

export async function submitUserRoleForm(
  _prev: UserMgmtState | null,
  formData: FormData,
): Promise<UserMgmtState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const role = formData.get("role") as UserRole;
  return updateUserRole(userId, role);
}

export async function submitUserStatusForm(
  _prev: UserMgmtState | null,
  formData: FormData,
): Promise<UserMgmtState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const status = formData.get("status") as UserStatus;
  return setUserStatus(userId, status);
}

export async function submitUserScopesForm(
  _prev: UserMgmtState | null,
  formData: FormData,
): Promise<UserMgmtState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const seasonIds = formData.getAll("seasonScope").map(String).filter(Boolean);
  const classroomIds = formData.getAll("classroomScope").map(String).filter(Boolean);
  return updateUserScopes(userId, seasonIds, classroomIds);
}

export async function submitAdminPasswordForm(
  _prev: UserMgmtState | null,
  formData: FormData,
): Promise<UserMgmtState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return adminSetPassword(userId, password);
}

export async function submitResendInviteForm(
  _prev: UserMgmtState | null,
  formData: FormData,
): Promise<UserMgmtState> {
  const userId = String(formData.get("userId") ?? "").trim();
  return resendStaffInvite(userId);
}
