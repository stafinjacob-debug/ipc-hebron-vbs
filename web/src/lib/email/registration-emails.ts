import { prisma } from "@/lib/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { qrPngBase64ForTicketUrl, registrationTicketUrl } from "@/lib/registration-identity";
import { isMicrosoftGraphEmailConfigured, sendMailViaMicrosoftGraph } from "@/lib/email/microsoft-graph";

function brandName(): string {
  return (
    process.env.REGISTRATION_EMAIL_BRAND?.trim() ||
    process.env.EMAIL_FROM_DISPLAY_NAME?.trim() ||
    "IPC Hebron VBS"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared layout: header band, card body, footer. */
function emailShell(inner: string): string {
  const brand = escapeHtml(brandName());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${brand}</title>
</head>
<body style="margin:0;padding:0;background:#eef6ff;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:0;height:6px;background:#1e90ff;"></td>
          </tr>
          <tr>
            <td style="background:linear-gradient(120deg,#ffd447 0%,#17bebb 55%,#6a4c93 100%);padding:28px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Vacation Bible School</p>
              <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;">${brand}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 32px;color:#334155;font-size:16px;line-height:1.6;">
              ${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;text-align:center;font-size:12px;color:#94a3b8;">
              This message was sent by your church VBS team. Please do not reply if you were not expecting it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type EmailSendResult =
  | "sent"
  | "skipped_no_email"
  | "skipped_no_graph"
  | "skipped_ineligible"
  | "failed";

async function sendHtml(
  to: string,
  toName: string | null | undefined,
  subject: string,
  html: string,
  attachments?: Parameters<typeof sendMailViaMicrosoftGraph>[0]["attachments"],
): Promise<{ result: EmailSendResult; error?: string }> {
  if (!isMicrosoftGraphEmailConfigured()) {
    return { result: "skipped_no_graph" };
  }
  const r = await sendMailViaMicrosoftGraph({
    toAddress: to,
    toName,
    subject,
    htmlBody: html,
    attachments,
  });
  if (r.ok) return { result: "sent" };
  return { result: "failed", error: r.error };
}

function compactTicketBlock(args: {
  childName: string;
  registrationNumber: string;
  detailLine: string;
  ticketUrl: string;
  cid: string;
}): string {
  return `
    <tr>
      <td style="padding:0 0 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #cfe6ff;border-radius:14px;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);box-shadow:0 6px 18px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#22c55e,#06b6d4,#6366f1,#f59e0b);border-radius:14px 14px 0 0;"></td>
          </tr>
          <tr>
            <td style="padding:12px 12px 8px;">
              <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${args.childName}</p>
              <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#0b7ab8;">Registration #</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:800;letter-spacing:0.04em;color:#075985;font-family:ui-monospace,Consolas,monospace;">${args.registrationNumber}</p>
              <p style="margin:6px 0 0;font-size:12px;color:#475569;">${args.detailLine}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 12px 12px;">
              <img src="cid:${args.cid}" width="150" height="150" alt="QR code for ${args.childName}" style="display:block;border-radius:10px;background:#fff;border:1px solid #dbeafe;" />
              <p style="margin:10px 0 0;">
                <a href="${args.ticketUrl}" style="display:inline-block;background:linear-gradient(90deg,#0f766e,#0891b2);color:#ffffff;padding:9px 14px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:700;box-shadow:0 6px 14px rgba(8,145,178,0.28);">Open Digital Card</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** After public form submit — guardian receives summary (pending review). */
export async function sendSubmissionReceivedEmail(submissionId: string): Promise<EmailSendResult> {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      guardian: true,
      season: true,
      registrations: { include: { child: true, classroom: true } },
    },
  });
  if (!submission?.guardian.email?.trim()) return "skipped_no_email";

  const to = submission.guardian.email.trim();
  const gname = `${submission.guardian.firstName} ${submission.guardian.lastName}`.trim();
  const season = escapeHtml(submission.season.name);
  const base = getPublicAppBaseUrl();
  const attachments: NonNullable<Parameters<typeof sendMailViaMicrosoftGraph>[0]["attachments"]> = [];
  let blocks = "";
  for (let i = 0; i < submission.registrations.length; i++) {
    const r = submission.registrations[i];
    if (!r.registrationNumber || !r.checkInToken) continue;
    const cid = `submitqr${i}`;
    const ticketUrl = registrationTicketUrl(r.checkInToken, base);
    const qrB64 = await qrPngBase64ForTicketUrl(ticketUrl);
    attachments.push({
      name: `qr-${r.registrationNumber}.png`,
      contentType: "image/png",
      contentBytesBase64: qrB64,
      isInline: true,
      contentId: cid,
    });
    blocks += compactTicketBlock({
      childName: escapeHtml(`${r.child.firstName} ${r.child.lastName}`),
      registrationNumber: escapeHtml(r.registrationNumber),
      detailLine: `${escapeHtml(r.status)} · ${escapeHtml(r.classroom?.name ?? "Class pending")}`,
      ticketUrl: escapeHtml(ticketUrl),
      cid,
    });
  }
  if (!blocks) return "skipped_ineligible";

  const paidNote = submission.stripePaidAt
    ? `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:14px;">Your online payment was received — thank you.</p>`
    : "";

  const inner = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    ${paidNote}
    <p style="margin:0 0 14px;">Thanks for registering for <strong>${season}</strong>. Each child now has a registration number and digital check-in card:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${blocks}</table>
    <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Save this email for check-in day. Staff may still follow up if details need review.</p>
  `;

  const { result, error } = await sendHtml(
    to,
    gname,
    `${brandName()} — Your family registration details`,
    emailShell(inner),
    attachments,
  );

  if (result === "sent") {
    await prisma.registration.updateMany({
      where: { formSubmissionId: submissionId },
      data: { submissionReceivedEmailSentAt: new Date() },
    });
  }
  if (result === "failed") console.error("[registration email]", error);
  return result === "failed" ? "failed" : result === "sent" ? "sent" : "skipped_no_graph";
}

async function loadRegistrationForEmail(id: string) {
  return prisma.registration.findUnique({
    where: { id },
    include: {
      child: { include: { guardian: true } },
      season: true,
      classroom: true,
    },
  });
}

/** Single confirmed child — QR + details (used after admin approval / resend one). */
export async function sendRegistrationApprovedEmail(
  registrationId: string,
  opts?: { recordSentTimestamp: boolean },
): Promise<EmailSendResult> {
  const record = opts?.recordSentTimestamp !== false;
  const reg = await loadRegistrationForEmail(registrationId);
  if (!reg) return "skipped_no_email";
  if (reg.status !== "CONFIRMED") return "skipped_ineligible";
  if (!reg.checkInToken || !reg.registrationNumber) return "skipped_ineligible";
  const guardian = reg.child.guardian;
  if (!guardian?.email?.trim()) return "skipped_no_email";

  const base = getPublicAppBaseUrl();
  const ticketUrl = registrationTicketUrl(reg.checkInToken, base);
  const qrB64 = await qrPngBase64ForTicketUrl(ticketUrl);
  const cid = "vbsregqr";

  const childName = `${reg.child.firstName} ${reg.child.lastName}`;
  const gname = `${guardian.firstName} ${guardian.lastName}`.trim();
  const season = escapeHtml(reg.season.name);
  const cls = reg.classroom ? escapeHtml(reg.classroom.name) : "To be assigned";
  const num = escapeHtml(reg.registrationNumber ?? "Pending approval");
  const dates = `${reg.season.startDate.toLocaleDateString()} – ${reg.season.endDate.toLocaleDateString()}`;

  const inner = `
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0ea5e9;">VBS Confirmation</p>
    <h2 style="margin:0 0 8px;font-size:28px;line-height:1.2;font-weight:800;color:#0f172a;">You&apos;re In! Welcome to Illumination Station!</h2>
    <p style="margin:0 0 8px;font-size:17px;line-height:1.4;color:#1e293b;"><strong>${escapeHtml(childName)}</strong> is all set for <strong>${season}</strong>!</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#0f766e;"><strong>Shining a light on who Jesus really is - John 8:12</strong></p>
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 14px;">Great news! Your child&apos;s spot is confirmed. Keep this card handy for a smooth and joyful check-in.</p>
    <div style="border:1px dashed #7dd3fc;border-radius:12px;padding:16px 18px;background:linear-gradient(180deg,#f0f9ff 0%,#eefcff 100%);margin:0 0 18px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#0369a1;">&#127915; Your Check-in Code</p>
      <p style="margin:0 0 14px;font-size:24px;font-weight:800;letter-spacing:0.06em;color:#075985;font-family:ui-monospace,Consolas,monospace;">${num}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;"><strong>Dates:</strong> ${escapeHtml(dates)}<br/>
      <strong>Class:</strong> ${cls}</p>
    </div>
    <p style="margin:0 0 8px;font-size:17px;line-height:1.35;font-weight:700;color:#0f172a;">Scan this at check-in to shine right in!</p>
    <p style="margin:0 0 10px;font-size:14px;color:#475569;">Show this at the welcome desk or open it on your phone.</p>
    <div style="text-align:center;margin:16px 0;padding:20px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;">
      <img src="cid:${cid}" width="200" height="200" alt="Registration QR code" style="display:inline-block;border-radius:8px;" />
    </div>
    <p style="margin:18px 0 0;text-align:center;">
      <a href="${escapeHtml(ticketUrl)}" style="display:inline-block;background:linear-gradient(90deg,#0f766e,#0891b2);color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700;">Open Digital Card</a>
    </p>
    <p style="margin:18px 0 0;font-size:14px;color:#334155;">Kid-friendly reminder: bring your biggest smile, comfy shoes, and a heart ready for fun.</p>
  `;

  const { result, error } = await sendHtml(
    guardian.email.trim(),
    gname,
    `${brandName()} — Confirmed: VBS registration for ${childName.split(" ")[0]}`,
    emailShell(inner),
    [
      {
        name: "check-in-qr.png",
        contentType: "image/png",
        contentBytesBase64: qrB64,
        isInline: true,
        contentId: cid,
      },
    ],
  );

  if (result === "failed") console.error("[registration email]", error);
  if (result === "sent" && record) {
    await prisma.registration.update({
      where: { id: registrationId },
      data: { confirmationEmailSentAt: new Date() },
    });
  }
  if (result === "sent") return "sent";
  if (result === "skipped_no_graph") return "skipped_no_graph";
  return "failed";
}

/** One email with a QR block per confirmed child (submission-level resend). */
export async function sendAllApprovedRegistrationsEmailForSubmission(submissionId: string): Promise<EmailSendResult> {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      guardian: true,
      registrations: {
        where: { status: "CONFIRMED" },
        include: { child: true, season: true, classroom: true },
      },
    },
  });
  if (!submission?.guardian.email?.trim()) return "skipped_no_email";
  const confirmedWithIdentity = submission.registrations.filter(
    (r) => Boolean(r.checkInToken) && Boolean(r.registrationNumber),
  );
  if (confirmedWithIdentity.length === 0) return "skipped_ineligible";

  const base = getPublicAppBaseUrl();
  const attachments: NonNullable<Parameters<typeof sendMailViaMicrosoftGraph>[0]["attachments"]> = [];
  let blocks = "";
  let i = 0;
  for (const reg of confirmedWithIdentity) {
    const ticketUrl = registrationTicketUrl(reg.checkInToken!, base);
    const qrB64 = await qrPngBase64ForTicketUrl(ticketUrl);
    const cid = `vbsqr${i}`;
    attachments.push({
      name: `qr-${reg.registrationNumber}.png`,
      contentType: "image/png",
      contentBytesBase64: qrB64,
      isInline: true,
      contentId: cid,
    });
    const childName = escapeHtml(`${reg.child.firstName} ${reg.child.lastName}`);
    const num = escapeHtml(reg.registrationNumber!);
    const season = escapeHtml(reg.season.name);
    const cls = reg.classroom ? escapeHtml(reg.classroom.name) : "Class pending";
    blocks += compactTicketBlock({
      childName,
      registrationNumber: num,
      detailLine: `${season} · ${cls}`,
      ticketUrl: escapeHtml(ticketUrl),
      cid,
    });
    i++;
  }

  const gname = `${submission.guardian.firstName} ${submission.guardian.lastName}`.trim();
  const inner = `
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0ea5e9;">VBS Confirmation</p>
    <h2 style="margin:0 0 8px;font-size:26px;line-height:1.2;font-weight:800;color:#0f172a;">Your family is all set for camp!</h2>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.45;color:#0f766e;"><strong>Shining a light on who Jesus really is - John 8:12</strong></p>
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 14px;">Your confirmed registrations are ready. Each child&apos;s digital card is below:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${blocks}</table>
    <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Save this email and show each QR code at check-in. We can&apos;t wait to see your family!</p>
  `;

  const { result, error } = await sendHtml(
    submission.guardian.email.trim(),
    gname,
    `${brandName()} — Your confirmed VBS registration(s)`,
    emailShell(inner),
    attachments,
  );

  if (result === "failed") console.error("[registration email]", error);
  if (result === "sent") {
    const now = new Date();
    await prisma.registration.updateMany({
      where: { formSubmissionId: submissionId, status: "CONFIRMED" },
      data: { confirmationEmailSentAt: now },
    });
  }
  if (result === "sent") return "sent";
  if (result === "skipped_no_graph") return "skipped_no_graph";
  return "failed";
}

export async function sendPaymentReminderEmail(registrationId: string): Promise<EmailSendResult> {
  const reg = await loadRegistrationForEmail(registrationId);
  if (!reg) return "skipped_no_email";
  if (!reg.expectsPayment || reg.paymentReceivedAt) return "skipped_ineligible";

  const guardian = reg.child.guardian;
  if (!guardian?.email?.trim()) return "skipped_no_email";

  const childName = `${reg.child.firstName} ${reg.child.lastName}`;
  const gname = `${guardian.firstName} ${guardian.lastName}`.trim();
  const num = escapeHtml(reg.registrationNumber ?? "Pending approval");
  const season = escapeHtml(reg.season.name);
  const contact =
    process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ||
    process.env.VBS_OFFICE_EMAIL?.trim() ||
    "";

  const inner = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 16px;">This is a friendly reminder about the program fee for <strong>${escapeHtml(childName)}</strong>’s registration <strong>${num}</strong> for <strong>${season}</strong>.</p>
    <p style="margin:0 0 16px;">If you’ve already paid, thank you — you can disregard this message.</p>
    ${
      contact
        ? `<p style="margin:0;font-size:14px;color:#475569;">Questions? Reply or write to <a href="mailto:${escapeHtml(contact)}" style="color:#2563eb;">${escapeHtml(contact)}</a>.</p>`
        : `<p style="margin:0;font-size:14px;color:#475568;">Questions? Contact the church office.</p>`
    }
  `;

  const { result, error } = await sendHtml(
    guardian.email.trim(),
    gname,
    `${brandName()} — Payment reminder (VBS)`,
    emailShell(inner),
  );

  if (result === "failed") console.error("[registration email]", error);
  if (result === "sent") {
    await prisma.registration.update({
      where: { id: registrationId },
      data: { paymentReminderSentAt: new Date() },
    });
  }
  if (result === "sent") return "sent";
  if (result === "skipped_no_graph") return "skipped_no_graph";
  return "failed";
}
