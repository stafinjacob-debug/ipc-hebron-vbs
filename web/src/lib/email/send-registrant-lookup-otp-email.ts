import { sendMailViaMicrosoftGraph, isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";
import type { RegistrationContactFooterInput } from "@/lib/email/registration-contact-footer-html";
import { registrationContactFooterHtml } from "@/lib/email/registration-contact-footer-html";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOtpHtml(params: {
  toName: string;
  code: string;
  minutesValid: number;
  brand: string;
  contactFooter?: RegistrationContactFooterInput | null;
}): string {
  const code = escapeHtml(params.code);
  const greeting = escapeHtml(params.toName);
  const b = escapeHtml(params.brand);
  const footer = params.contactFooter
    ? registrationContactFooterHtml(params.contactFooter, {
        style: "margin:16px 0 0;font-size:14px;color:#475569;",
      })
    : "";

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, Segoe UI, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>Hi ${greeting},</p>
  <p>Use this code to view or update your <strong>${b}</strong> registration:</p>
  <p style="margin: 24px 0; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; font-family: ui-monospace, monospace;">${code}</p>
  <p>This code expires in <strong>${params.minutesValid} minutes</strong>. If you did not request this, you can ignore this email.</p>
  ${footer}
</body>
</html>`;
}

export type SendRegistrantLookupOtpEmailResult =
  | { mode: "sent" }
  | { mode: "skipped_no_provider" }
  | { mode: "failed"; error: string };

export async function sendRegistrantLookupOtpEmail(params: {
  toEmail: string;
  toName: string;
  code: string;
  minutesValid: number;
  /** Event / season name for sender display and email copy. */
  eventName?: string | null;
  contactFooter?: RegistrationContactFooterInput | null;
}): Promise<SendRegistrantLookupOtpEmailResult> {
  if (!isMicrosoftGraphEmailConfigured()) {
    return { mode: "skipped_no_provider" };
  }

  const brand =
    params.eventName?.trim() ||
    process.env.EMAIL_FROM_DISPLAY_NAME?.trim() ||
    "IPC Hebron VBS";
  const subject = `${brand} — Registration lookup code`;

  const result = await sendMailViaMicrosoftGraph({
    toAddress: params.toEmail,
    toName: params.toName,
    subject,
    htmlBody: buildOtpHtml({
      toName: params.toName,
      code: params.code,
      minutesValid: params.minutesValid,
      brand,
      contactFooter: params.contactFooter,
    }),
    fromName: params.eventName,
  });

  if (result.ok) return { mode: "sent" };
  return { mode: "failed", error: result.error };
}
