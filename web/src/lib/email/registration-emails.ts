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
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#0ea5e9 100%);padding:28px 24px;text-align:center;">
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

/** After public form submit — guardian receives summary (pending review). */
export async function sendSubmissionReceivedEmail(submissionId: string): Promise<EmailSendResult> {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      guardian: true,
      season: true,
      registrations: { include: { child: true } },
    },
  });
  if (!submission?.guardian.email?.trim()) return "skipped_no_email";

  const to = submission.guardian.email.trim();
  const gname = `${submission.guardian.firstName} ${submission.guardian.lastName}`.trim();
  const season = escapeHtml(submission.season.name);
  const code = escapeHtml(submission.registrationCode);
  const rows = submission.registrations
    .map((r) => {
      const nm = escapeHtml(`${r.child.firstName} ${r.child.lastName}`);
      const st = escapeHtml(r.status);
      return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${nm}</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${st}</td></tr>`;
    })
    .join("");

  const inner = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 16px;">Thank you for registering for <strong>${season}</strong>. We received your submission and our team will review it shortly.</p>
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Your reference code</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:0.04em;color:#0f172a;font-family:ui-monospace,monospace;">${code}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <thead><tr style="background:#f8fafc;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">
        <th align="left" style="padding:10px 12px;">Child</th>
        <th align="left" style="padding:10px 12px;">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:20px 0 0;font-size:14px;color:#64748b;">After a staff member approves each child’s registration, you will receive a separate email with that child’s <strong>registration number</strong> and a <strong>QR code</strong> for check-in.</p>
  `;

  const { result, error } = await sendHtml(
    to,
    gname,
    `${brandName()} — We received your registration`,
    emailShell(inner),
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
      formSubmission: { select: { registrationCode: true } },
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
  const ref = reg.formSubmission?.registrationCode
    ? escapeHtml(reg.formSubmission.registrationCode)
    : "—";
  const num = escapeHtml(reg.registrationNumber ?? "Pending approval");
  const dates = `${reg.season.startDate.toLocaleDateString()} – ${reg.season.endDate.toLocaleDateString()}`;

  const inner = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 16px;">Great news — <strong>${escapeHtml(childName)}</strong> is <strong>confirmed</strong> for <strong>${season}</strong>!</p>
    <div style="background:linear-gradient(180deg,#f0f9ff 0%,#ffffff 100%);border:1px solid #bae6fd;border-radius:12px;padding:20px;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#0369a1;">Registration number</p>
      <p style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:0.06em;color:#0c4a6e;font-family:ui-monospace,monospace;">${num}</p>
      <p style="margin:0;font-size:14px;color:#475569;"><strong>Dates:</strong> ${escapeHtml(dates)}<br/>
      <strong>Class:</strong> ${cls}<br/>
      <strong>Family ref:</strong> ${ref}</p>
    </div>
    <p style="margin:0 0 12px;font-weight:600;color:#0f172a;">Check-in QR code</p>
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Show this at the welcome desk or open the link on your phone.</p>
    <div style="text-align:center;margin:16px 0;padding:16px;background:#f8fafc;border-radius:12px;">
      <img src="cid:${cid}" width="200" height="200" alt="Registration QR code" style="display:inline-block;border-radius:8px;" />
    </div>
    <p style="margin:16px 0 0;font-size:13px;word-break:break-all;">
      <a href="${escapeHtml(ticketUrl)}" style="color:#2563eb;">Open digital ticket</a>
    </p>
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
    const cls = reg.classroom ? escapeHtml(reg.classroom.name) : "To be assigned";
    blocks += `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 16px;background:#fafafa;">
        <p style="margin:0 0 8px;font-weight:700;color:#0f172a;">${childName}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#475569;"><strong>Registration #</strong> ${num}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#475569;">${season} · ${cls}</p>
        <div style="text-align:center;"><img src="cid:${cid}" width="180" height="180" alt="QR" style="border-radius:8px;" /></div>
        <p style="margin:12px 0 0;text-align:center;font-size:12px;"><a href="${escapeHtml(ticketUrl)}" style="color:#2563eb;">Open ticket</a></p>
      </div>`;
    i++;
  }

  const gname = `${submission.guardian.firstName} ${submission.guardian.lastName}`.trim();
  const inner = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 16px;">Here are the confirmed VBS registrations and check-in QR codes for your family.</p>
    ${blocks}
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
