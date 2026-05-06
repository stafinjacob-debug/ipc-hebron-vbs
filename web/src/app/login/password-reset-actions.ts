"use server";

import { randomInt } from "crypto";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetOtpEmail } from "@/lib/email/send-password-reset-otp-email";
import { isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";
import { logStaffAccess } from "@/lib/access-audit";
import { findUserRawByEmail } from "@/lib/user-auth-raw";

export type PasswordResetActionState = { ok: boolean; message: string };

const OTP_TTL_MIN = 15;
const OTP_SENDS_PER_HOUR = 4;
const MAX_OTP_ATTEMPTS = 8;
const BCRYPT_OTP_ROUNDS = 10;

function normalizeEmailInput(raw: string): string {
  return raw.trim().toLowerCase();
}

const emailSchema = z.string().email();

function neutralRequestMessage(): string {
  return "If that email matches an active staff account with a password, we sent a 6-digit code. It expires in 15 minutes.";
}

export async function requestPasswordResetOtpAction(formData: FormData): Promise<PasswordResetActionState> {
  const rawEmail = normalizeEmailInput(String(formData.get("email") ?? ""));
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const emailNormalized = parsed.data;

  if (!isMicrosoftGraphEmailConfigured()) {
    return {
      ok: false,
      message:
        "Password reset email is not available because outbound mail is not configured. Ask an administrator to set Microsoft Graph mail (see .env.example).",
    };
  }

  const row = await findUserRawByEmail(emailNormalized);
  const eligible =
    row &&
    row.passwordHash &&
    (row.status ?? "ACTIVE") === "ACTIVE" &&
    row.role !== "PARENT";

  if (!eligible) {
    return { ok: true, message: neutralRequestMessage() };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await prisma.passwordResetOtp.count({
    where: {
      emailNormalized,
      createdAt: { gte: hourAgo },
    },
  });
  if (recentSends >= OTP_SENDS_PER_HOUR) {
    return { ok: true, message: neutralRequestMessage() };
  }

  await prisma.passwordResetOtp.deleteMany({
    where: { emailNormalized, consumedAt: null },
  });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hash(code, BCRYPT_OTP_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

  const otpRow = await prisma.passwordResetOtp.create({
    data: {
      emailNormalized,
      codeHash,
      expiresAt,
    },
  });

  const send = await sendPasswordResetOtpEmail({
    toEmail: row.email,
    toName: row.name?.trim() || row.email.split("@")[0] || "there",
    code,
    minutesValid: OTP_TTL_MIN,
  });

  if (send.mode !== "sent") {
    await prisma.passwordResetOtp.delete({ where: { id: otpRow.id } }).catch(() => {});
    if (send.mode === "skipped_no_provider") {
      return {
        ok: false,
        message:
          "Password reset email is not available because outbound mail is not configured. Ask an administrator.",
      };
    }
    return {
      ok: false,
      message: `Could not send the code: ${send.error}. Try again in a few minutes or contact support.`,
    };
  }

  await logStaffAccess("PASSWORD_RESET_OTP_SENT", {
    targetUserId: row.id,
    metadata: { email: emailNormalized },
  }).catch(() => {});

  return { ok: true, message: neutralRequestMessage() };
}

export async function completePasswordResetWithOtpAction(formData: FormData): Promise<PasswordResetActionState> {
  const rawEmail = normalizeEmailInput(String(formData.get("email") ?? ""));
  const parsedEmail = emailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const emailNormalized = parsedEmail.data;

  const code = String(formData.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) {
    return { ok: false, message: "Enter the 6-digit code from your email." };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match." };
  }

  const userRow = await findUserRawByEmail(emailNormalized);
  if (!userRow?.passwordHash || (userRow.status ?? "ACTIVE") !== "ACTIVE" || userRow.role === "PARENT") {
    return { ok: false, message: "Invalid or expired code. Request a new code from the reset form." };
  }

  const otp = await prisma.passwordResetOtp.findFirst({
    where: {
      emailNormalized,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { ok: false, message: "Invalid or expired code. Request a new code from the reset form." };
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, message: "Too many incorrect attempts. Request a new code." };
  }

  const codeOk = await compare(code, otp.codeHash);
  if (!codeOk) {
    await prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, message: "Incorrect code. Check the email and try again." };
  }

  const passwordHash = await hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userRow.id },
      data: { passwordHash },
    }),
    prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetOtp.deleteMany({
      where: { emailNormalized, consumedAt: null, id: { not: otp.id } },
    }),
  ]);

  await logStaffAccess("PASSWORD_RESET_COMPLETED", {
    targetUserId: userRow.id,
    metadata: { email: emailNormalized },
  }).catch(() => {});

  return { ok: true, message: "Password updated. You can sign in with your new password." };
}
