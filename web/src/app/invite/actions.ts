"use server";

import { logStaffAccess } from "@/lib/access-audit";
import { hashInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export type InviteAcceptState = { ok: boolean; message: string };

export async function acceptInviteSetup(
  _prev: InviteAcceptState | null,
  formData: FormData,
): Promise<InviteAcceptState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, message: "Missing invitation link." };
  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "Passwords do not match." };

  const tokenHash = hashInviteToken(token);
  const user = await prisma.user.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    return { ok: false, message: "This invitation is invalid or has expired. Ask an admin to resend it." };
  }

  if (user.status !== "INVITED" && user.status !== "PENDING_SETUP") {
    return { ok: false, message: "This invitation is no longer valid. Ask an admin for a new invite." };
  }

  const passwordHash = await hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });

  await logStaffAccess("INVITE_ACCEPTED", {
    targetUserId: user.id,
    metadata: { email: user.email },
  });

  return { ok: true, message: "Your account is ready. You can sign in with your email and password." };
}
