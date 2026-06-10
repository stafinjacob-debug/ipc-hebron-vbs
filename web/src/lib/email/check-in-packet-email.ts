import type { GraphMailAttachment } from "@/lib/email/microsoft-graph";
import { sendMailViaMicrosoftGraph } from "@/lib/email/microsoft-graph";
import { compactTicketBlock, emailShell } from "@/lib/email/registration-emails";
import type { CheckInPacketRecipient } from "@/lib/compose-registrant-audience";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { qrPngBase64ForTicketUrl, registrationTicketUrl } from "@/lib/registration-identity";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandName(): string {
  return (
    process.env.REGISTRATION_EMAIL_BRAND?.trim() ||
    process.env.EMAIL_FROM_DISPLAY_NAME?.trim() ||
    "IPC Hebron VBS"
  );
}

function helpEmailAddress(): string {
  return process.env.VBS_HELP_EMAIL?.trim() || "vbs@ipchouston.com";
}

export type CheckInPacketAttachment = {
  fileName: string;
  contentType: string;
  contentBytesBase64: string;
};

export type CheckInPacketSendResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendCheckInPacketEmail(args: {
  recipient: CheckInPacketRecipient;
  subject: string;
  introHtml: string;
  attachment?: CheckInPacketAttachment | null;
}): Promise<CheckInPacketSendResult> {
  const base = getPublicAppBaseUrl();
  const attachments: GraphMailAttachment[] = [];
  let blocks = "";
  let ticketIndex = 0;

  for (const child of args.recipient.children) {
    const cid = `packetqr${ticketIndex}`;
    ticketIndex += 1;
    const ticketUrl = registrationTicketUrl(child.checkInToken, base);
    const qrB64 = await qrPngBase64ForTicketUrl(ticketUrl);
    attachments.push({
      name: `qr-${child.registrationNumber}.png`,
      contentType: "image/png",
      contentBytesBase64: qrB64,
      isInline: true,
      contentId: cid,
    });
    const childName = escapeHtml(`${child.firstName} ${child.lastName}`.trim());
    const classroom = child.classroomName ? escapeHtml(child.classroomName) : "Class pending";
    blocks += compactTicketBlock({
      childName,
      registrationNumber: escapeHtml(child.registrationNumber),
      detailLine: `${escapeHtml(child.seasonName)} · ${classroom}`,
      ticketUrl: escapeHtml(ticketUrl),
      cid,
    });
  }

  if (!blocks) {
    return { ok: false, error: "No check-in cards to include for this family." };
  }

  if (args.attachment) {
    attachments.push({
      name: args.attachment.fileName,
      contentType: args.attachment.contentType,
      contentBytesBase64: args.attachment.contentBytesBase64,
      isInline: false,
    });
  }

  const intro = args.introHtml.trim()
    ? `<div style="margin:0 0 16px;">${args.introHtml}</div>`
    : `<p style="margin:0 0 14px;">Your check-in details for <strong>${escapeHtml(brandName())}</strong> are below. Save this email and show each QR code at the welcome desk.</p>`;

  const attachmentNote = args.attachment
    ? `<p style="margin:0 0 14px;font-size:14px;color:#475569;">A file is attached to this email: <strong>${escapeHtml(args.attachment.fileName)}</strong>.</p>`
    : "";

  const inner = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(args.recipient.guardianName)},</p>
    ${intro}
    ${attachmentNote}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${blocks}</table>
    <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Show each child&apos;s digital card (QR code) at check-in. Screenshot for offline use if helpful.</p>
    <p style="margin:8px 0 0;font-size:13px;color:#475569;">Questions? Email <a href="mailto:${escapeHtml(helpEmailAddress())}" style="color:#2563eb;">${escapeHtml(helpEmailAddress())}</a>.</p>
  `;

  const result = await sendMailViaMicrosoftGraph({
    toAddress: args.recipient.email,
    toName: args.recipient.guardianName,
    subject: args.subject,
    htmlBody: emailShell(inner),
    attachments,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
