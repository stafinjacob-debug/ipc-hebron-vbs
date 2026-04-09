import { sendMailViaMicrosoftGraph, isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";
import { roleLabel } from "@/lib/roles";
import type { UserRole } from "@/generated/prisma";

export type StaffInviteEmailParams = {
  toEmail: string;
  toName: string;
  inviteLink: string;
  role: UserRole;
  inviterDisplayName?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInviteHtml(params: StaffInviteEmailParams): string {
  const fromName = process.env.EMAIL_FROM_DISPLAY_NAME?.trim() || "IPC Hebron VBS";
  const role = roleLabel(params.role);
  const greeting = escapeHtml(params.toName);
  const link = escapeHtml(params.inviteLink);
  const inviter = params.inviterDisplayName?.trim()
    ? escapeHtml(params.inviterDisplayName.trim())
    : "A church administrator";

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, Segoe UI, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>Hi ${greeting},</p>
  <p>${inviter} invited you to the <strong>${escapeHtml(fromName)}</strong> staff portal as <strong>${escapeHtml(role)}</strong>.</p>
  <p>Use the button below to choose a password and activate your account. This link expires in 7 days.</p>
  <p style="margin: 24px 0;">
    <a href="${link}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Accept invitation</a>
  </p>
  <p style="font-size: 14px; color: #555;">If the button doesn’t work, copy and paste this URL into your browser:<br/>
  <span style="word-break: break-all;">${link}</span></p>
  <p style="font-size: 13px; color: #888;">If you didn’t expect this email, you can ignore it.</p>
</body>
</html>`;
}

export type SendStaffInviteEmailResult =
  | { mode: "sent" }
  | { mode: "skipped_no_provider" }
  | { mode: "failed"; error: string };

/**
 * Sends invite email via Microsoft Graph when env is configured; otherwise skipped.
 */
export async function sendStaffInviteEmail(params: StaffInviteEmailParams): Promise<SendStaffInviteEmailResult> {
  if (!isMicrosoftGraphEmailConfigured()) {
    return { mode: "skipped_no_provider" };
  }

  const fromName = process.env.EMAIL_FROM_DISPLAY_NAME?.trim() || "IPC Hebron VBS";
  const subject = `${fromName} — You’re invited to the VBS staff portal`;

  const result = await sendMailViaMicrosoftGraph({
    toAddress: params.toEmail,
    toName: params.toName,
    subject,
    htmlBody: buildInviteHtml(params),
  });

  if (result.ok) return { mode: "sent" };
  return { mode: "failed", error: result.error };
}
