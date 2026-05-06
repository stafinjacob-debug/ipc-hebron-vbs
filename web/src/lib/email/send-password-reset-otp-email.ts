import { sendMailViaMicrosoftGraph, isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOtpHtml(params: { toName: string; code: string; minutesValid: number }): string {
  const brand = process.env.EMAIL_FROM_DISPLAY_NAME?.trim() || "IPC Hebron VBS";
  const code = escapeHtml(params.code);
  const greeting = escapeHtml(params.toName);
  const b = escapeHtml(brand);

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, Segoe UI, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>Hi ${greeting},</p>
  <p>Someone requested a password reset for your <strong>${b}</strong> staff portal account.</p>
  <p style="margin: 24px 0; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; font-family: ui-monospace, monospace;">${code}</p>
  <p>This code expires in <strong>${params.minutesValid} minutes</strong>. If you did not request this, you can ignore this email.</p>
  <p style="font-size: 13px; color: #888;">Never share this code with anyone. Staff will never ask you for it.</p>
</body>
</html>`;
}

export type SendPasswordResetOtpEmailResult =
  | { mode: "sent" }
  | { mode: "skipped_no_provider" }
  | { mode: "failed"; error: string };

export async function sendPasswordResetOtpEmail(params: {
  toEmail: string;
  toName: string;
  code: string;
  minutesValid: number;
}): Promise<SendPasswordResetOtpEmailResult> {
  if (!isMicrosoftGraphEmailConfigured()) {
    return { mode: "skipped_no_provider" };
  }

  const brand = process.env.EMAIL_FROM_DISPLAY_NAME?.trim() || "IPC Hebron VBS";
  const subject = `${brand} — Password reset code`;

  const result = await sendMailViaMicrosoftGraph({
    toAddress: params.toEmail,
    toName: params.toName,
    subject,
    htmlBody: buildOtpHtml({
      toName: params.toName,
      code: params.code,
      minutesValid: params.minutesValid,
    }),
  });

  if (result.ok) return { mode: "sent" };
  return { mode: "failed", error: result.error };
}
