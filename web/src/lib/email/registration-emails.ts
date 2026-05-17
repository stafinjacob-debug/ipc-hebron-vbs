import { prisma } from "@/lib/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import {
  makeCheckInToken,
  makeUniqueRegistrationNumber,
  qrPngBase64ForTicketUrl,
  registrationTicketUrl,
} from "@/lib/registration-identity";
import {
  signSubmissionPublicToken,
  submissionCancelUrl,
  submissionPayUrl,
} from "@/lib/registration-public-token";
import { formatVbsFirstDayLabel } from "@/lib/pay-later";
import { isCheckoutPendingRegistration } from "@/lib/registration-list-payment";
import { resolveCheckoutResumeUrlForSubmission } from "@/lib/stripe-registration-payment";
import { isMicrosoftGraphEmailConfigured, sendMailViaMicrosoftGraph } from "@/lib/email/microsoft-graph";
import { promises as fs } from "fs";
import path from "path";

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
            <td
              bgcolor="#0f766e"
              align="center"
              style="background-color:#0f766e;background-image:linear-gradient(120deg,#047857 0%,#0d9488 45%,#0e7490 100%);padding:22px 24px;text-align:center;"
            >
              <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#ecfdf5;">
                Vacation Bible School
              </p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">
                ${brand}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 28px;color:#334155;font-size:16px;line-height:1.6;">
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

async function loadThemeLogoInlineAttachment(): Promise<{
  cid: string;
  attachment: NonNullable<Parameters<typeof sendMailViaMicrosoftGraph>[0]["attachments"]>[number];
} | null> {
  try {
    const cid = "vbsthemelogo";
    const candidates = [
      {
        filePath: path.join(process.cwd(), "vbsthemelogo.png"),
        fileName: "vbsthemelogo.png",
        contentType: "image/png",
      },
      {
        filePath: path.join(process.cwd(), "vbsthemelogo.webp"),
        fileName: "vbsthemelogo.webp",
        contentType: "image/webp",
      },
    ] as const;
    for (const c of candidates) {
      try {
        const bytes = await fs.readFile(c.filePath);
        if (!bytes.length) continue;
        return {
          cid,
          attachment: {
            name: c.fileName,
            contentType: c.contentType,
            contentBytesBase64: bytes.toString("base64"),
            isInline: true,
            contentId: cid,
          },
        };
      } catch {
        // try next file format
      }
    }
    return null;
  } catch {
    return null;
  }
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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #cfe6ff;border-radius:14px;background-color:#ffffff;background-image:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);box-shadow:0 6px 18px rgba(15,23,42,0.06);">
          <tr>
            <td bgcolor="#0d9488" style="height:5px;background-color:#0d9488;background-image:linear-gradient(90deg,#059669,#06b6d4,#6366f1,#f59e0b);border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="148" align="center" valign="top" style="padding:12px 10px 14px 14px;">
                    <img src="cid:${args.cid}" width="128" height="128" alt="QR code for ${args.childName}" style="display:block;width:128px;height:128px;border-radius:10px;background-color:#ffffff;border:1px solid #dbeafe;margin:0 auto;" />
                  </td>
                  <td valign="middle" style="padding:12px 14px 14px 6px;font-size:14px;line-height:1.45;color:#334155;">
                    <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${args.childName}</p>
                    <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#0b7ab8;">Registration #</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:800;letter-spacing:0.04em;color:#075985;font-family:ui-monospace,Consolas,monospace;">${args.registrationNumber}</p>
                    <p style="margin:8px 0 0;font-size:12px;color:#475569;">${args.detailLine}</p>
                    <p style="margin:12px 0 0;">
                      <a href="${args.ticketUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:10px 14px;border-radius:999px;text-decoration:none;font-size:13px;line-height:1.1;font-weight:700;border:1px solid #0b5f58;">Open Digital Card</a>
                    </p>
                    <p style="margin:10px 0 0;font-size:11px;line-height:1.45;color:#64748b;">
                      If the button does not open, use this link:<br/>
                      <a href="${args.ticketUrl}" style="color:#0369a1;text-decoration:underline;word-break:break-all;">${args.ticketUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * After public submit when card checkout was skipped by the form’s rule — guardian gets a short
 * acknowledgment without registration numbers or QR codes (team review first).
 */
export async function sendSubmissionPendingReviewEmail(submissionId: string): Promise<EmailSendResult> {
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
  const contact = helpEmailAddress();

  const waitlisted = submission.registrations.some((r) => r.status === "WAITLIST");
  const waitlistNote = waitlisted
    ? `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:14px;">Based on current capacity, one or more children are on the <strong>waitlist</strong> for now. The team will let you know if a spot opens.</p>`
    : "";

  const childLines = submission.registrations
    .map((r) => {
      const n = `${r.child.firstName} ${r.child.lastName}`.trim();
      return n
        ? `<li style="margin:0 0 6px;"><strong>${escapeHtml(n)}</strong></li>`
        : `<li style="margin:0 0 6px;">Child registration</li>`;
    })
    .join("");

  const inner = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:14px;">
      Thank you — we have received your registration for <strong>${season}</strong>. Someone from our VBS team will review your details and confirm your enrollment. You do not have a check-in card yet; we will follow up by email when everything is confirmed.
    </p>
    ${waitlistNote}
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a;">Children on this submission</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#334155;font-size:15px;line-height:1.5;">
      ${childLines || `<li style="margin:0;">Your registered children</li>`}
    </ul>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;">If anything else is needed, we will reach out using the contact information you provided.</p>
    ${
      contact
        ? `<p style="margin:0;font-size:14px;color:#475569;">Questions in the meantime? Write to <a href="mailto:${escapeHtml(contact)}" style="color:#2563eb;">${escapeHtml(contact)}</a>.</p>`
        : `<p style="margin:0;font-size:14px;color:#475569;">Questions? Contact the church office.</p>`
    }
  `;

  const { result, error } = await sendHtml(
    to,
    gname,
    `${brandName()} — Registration received (under review)`,
    emailShell(inner),
  );

  if (result === "sent") {
    await prisma.registration.updateMany({
      where: { formSubmissionId: submissionId },
      data: { submissionReceivedEmailSentAt: new Date() },
    });
  }
  if (result === "failed") console.error("[registration email pending review]", error);
  return result === "failed" ? "failed" : result === "sent" ? "sent" : "skipped_no_graph";
}

/** After public form submit — guardian receives summary (pending review). */
/** Ensure every child on a submission has a registration # and check-in token before emailing tickets. */
async function ensureRegistrationIdentitiesForSubmission(submissionId: string): Promise<void> {
  const regs = await prisma.registration.findMany({
    where: {
      formSubmissionId: submissionId,
      OR: [{ registrationNumber: null }, { checkInToken: null }],
    },
    select: {
      id: true,
      seasonId: true,
      registrationNumber: true,
      checkInToken: true,
      season: { select: { year: true } },
    },
  });
  for (const r of regs) {
    const registrationNumber =
      r.registrationNumber ??
      (await makeUniqueRegistrationNumber({ seasonId: r.seasonId, seasonYear: r.season.year }));
    const checkInToken = r.checkInToken ?? makeCheckInToken();
    await prisma.registration.update({
      where: { id: r.id },
      data: {
        registrationNumber,
        checkInToken,
      },
    });
  }
}

function buildSubmissionReferenceCodeHtml(registrationCode: string): string {
  const code = escapeHtml(registrationCode);
  return `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#f0f9ff;border:1px solid #bae6fd;color:#0c4a6e;font-size:14px;line-height:1.5;">
      <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0369a1;">Family reference code</span>
      <span style="display:block;margin-top:6px;font-family:ui-monospace,Consolas,monospace;font-size:20px;font-weight:800;letter-spacing:0.04em;">${code}</span>
      <span style="display:block;margin-top:6px;font-size:13px;color:#475569;">Use this code if you contact the VBS team about your registration.</span>
    </p>`;
}

function buildPayLaterPaymentInstructionsHtml(args: {
  dayOneLabel: string;
  seasonName: string;
  cardPayUrl: string | null;
}): string {
  const dayOne = escapeHtml(args.dayOneLabel);
  const season = escapeHtml(args.seasonName);
  const cardLink = args.cardPayUrl
    ? `<a href="${escapeHtml(args.cardPayUrl)}" style="display:inline-block;margin-top:8px;background:#0f766e;color:#ffffff;padding:10px 16px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;">Pay by card online</a>`
    : "";

  return `
    <div style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:14px;line-height:1.55;">
      <p style="margin:0 0 10px;font-weight:700;color:#78350f;">Payment still due</p>
      <p style="margin:0 0 10px;">You chose to pay later for <strong>${season}</strong>. Pay by card online anytime before VBS, or pay on site on Day 1 (<strong>${dayOne}</strong>).</p>
      <p style="margin:0 0 8px;font-weight:600;">Pay earlier (card online)</p>
      <ul style="margin:0 0 12px;padding-left:20px;">
        <li style="margin:0 0 6px;"><strong>Card</strong> — secure online checkout${cardLink ? ` (use the button below)` : ""}</li>
      </ul>
      ${cardLink}
      <p style="margin:12px 0 8px;font-weight:600;">Pay on site — Day 1 (${dayOne})</p>
      <ul style="margin:0;padding-left:20px;">
        <li style="margin:0 0 6px;"><strong>Zelle</strong> or <strong>card</strong></li>
        <li style="margin:0;">Cash and checks are <strong>not</strong> accepted on site.</li>
      </ul>
    </div>`;
}

export async function sendSubmissionReceivedEmail(submissionId: string): Promise<EmailSendResult> {
  await ensureRegistrationIdentitiesForSubmission(submissionId);

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      guardian: true,
      season: true,
      registrations: {
        where: { status: { not: "CANCELLED" } },
        include: { child: true, classroom: true },
      },
    },
  });
  if (!submission?.guardian.email?.trim()) return "skipped_no_email";

  const to = submission.guardian.email.trim();
  const gname = `${submission.guardian.firstName} ${submission.guardian.lastName}`.trim();
  const season = escapeHtml(submission.season.name);
  const base = getPublicAppBaseUrl();
  const attachments: NonNullable<Parameters<typeof sendMailViaMicrosoftGraph>[0]["attachments"]> = [];
  let blocks = "";
  let ticketIndex = 0;
  for (const r of submission.registrations) {
    if (!r.registrationNumber || !r.checkInToken) continue;
    const cid = `submitqr${ticketIndex}`;
    ticketIndex += 1;
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

  const isPayLater = submission.payLaterChosen && !submission.stripePaidAt;
  const referenceBlock = buildSubmissionReferenceCodeHtml(submission.registrationCode);

  const paidNote = submission.stripePaidAt
    ? `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:14px;">Your online payment was received — thank you.</p>`
    : "";

  let payLaterBlock = "";
  if (isPayLater) {
    const payToken = signSubmissionPublicToken(submissionId, "pay");
    const cardPayUrl = payToken ? submissionPayUrl(payToken, base) : null;
    payLaterBlock = buildPayLaterPaymentInstructionsHtml({
      dayOneLabel: formatVbsFirstDayLabel(submission.season.startDate),
      seasonName: submission.season.name,
      cardPayUrl,
    });
  }

  const cardsIntro = isPayLater
    ? `<p style="margin:0 0 14px;">Thanks for registering for <strong>${season}</strong>. Each child has a registration number and digital check-in card below — save this email for check-in day. Payment is still due (card online before VBS, or on site on Day 1); see options after your cards.</p>`
    : `<p style="margin:0 0 14px;">Thanks for registering for <strong>${season}</strong>. Each child now has a registration number and digital check-in card:</p>`;

  const inner = isPayLater
    ? `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    ${referenceBlock}
    ${cardsIntro}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${blocks}</table>
    ${payLaterBlock}
    <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Show each child&apos;s digital card (QR code) at check-in. Staff may still follow up if details need review.</p>
    <p style="margin:8px 0 0;font-size:13px;color:#475569;">Questions? Email <a href="mailto:${escapeHtml(helpEmailAddress())}" style="color:#2563eb;">${escapeHtml(helpEmailAddress())}</a>.</p>
  `
    : `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    ${paidNote}
    ${referenceBlock}
    ${cardsIntro}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${blocks}</table>
    <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Save this email for check-in day. Staff may still follow up if details need review.</p>
    <p style="margin:8px 0 0;font-size:13px;color:#475569;">Questions? Email <a href="mailto:${escapeHtml(helpEmailAddress())}" style="color:#2563eb;">${escapeHtml(helpEmailAddress())}</a>.</p>
  `;

  const subject = isPayLater
    ? `${brandName()} — Your registration & check-in cards (payment due)`
    : `${brandName()} — Your family registration details`;

  const { result, error } = await sendHtml(
    to,
    gname,
    subject,
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
  const logo = await loadThemeLogoInlineAttachment();

  const childName = `${reg.child.firstName} ${reg.child.lastName}`;
  const gname = `${guardian.firstName} ${guardian.lastName}`.trim();
  const season = escapeHtml(reg.season.name);
  const cls = reg.classroom ? escapeHtml(reg.classroom.name) : "To be assigned";
  const num = escapeHtml(reg.registrationNumber ?? "Pending approval");
  const dates = `${reg.season.startDate.toLocaleDateString()} – ${reg.season.endDate.toLocaleDateString()}`;

  const inner = `
    ${
      logo
        ? `<p style="margin:-18px 0 8px;text-align:center;line-height:0;font-size:0;"><img src="cid:${logo.cid}" width="300" alt="Illumination Station" style="max-width:100%;height:auto;border:0;display:block;margin:0 auto;" /></p>`
        : ""
    }
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0ea5e9;">VBS Confirmation</p>
    <h2 style="margin:0 0 8px;font-size:28px;line-height:1.2;font-weight:800;color:#0f172a;">You&apos;re In! Welcome to Illumination Station!</h2>
    <p style="margin:0 0 8px;font-size:17px;line-height:1.4;color:#1e293b;"><strong>${escapeHtml(childName)}</strong> is all set for <strong>${season}</strong>!</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#0f766e;"><strong>Shining a light on who Jesus really is - John 8:12</strong></p>
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 14px;">Great news! Your child&apos;s spot is confirmed. Keep this card handy for a smooth and joyful check-in.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
      <tr>
        <td style="border:1px dashed #7dd3fc;border-radius:12px;background-color:#f0f9ff;background-image:linear-gradient(180deg,#f0f9ff 0%,#eefcff 100%);padding:0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td width="168" align="center" valign="top" style="padding:16px 12px 16px 16px;">
                <img src="cid:${cid}" width="144" height="144" alt="Registration QR code" style="display:block;width:144px;height:144px;border-radius:10px;background-color:#ffffff;border:1px solid #dbeafe;margin:0 auto;" />
              </td>
              <td valign="top" style="padding:16px 18px 16px 6px;font-size:14px;line-height:1.45;color:#334155;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#0369a1;">&#127915; Your Check-in Code</p>
                <p style="margin:0 0 12px;font-size:24px;font-weight:800;letter-spacing:0.06em;color:#075985;font-family:ui-monospace,Consolas,monospace;">${num}</p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;"><strong>Dates:</strong> ${escapeHtml(dates)}<br/>
                <strong>Class:</strong> ${cls}</p>
                <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a;">Scan this at check-in to shine right in!</p>
                <p style="margin:0 0 12px;color:#475569;">Show this at the welcome desk or open it on your phone.</p>
                <p style="margin:0;">
                  <a href="${escapeHtml(ticketUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-size:14px;line-height:1.1;font-weight:700;border:1px solid #0b5f58;">Open Digital Card</a>
                </p>
                <p style="margin:10px 0 0;font-size:12px;line-height:1.45;color:#64748b;">
                  If the button does not open, use this link:<br/>
                  <a href="${escapeHtml(ticketUrl)}" style="color:#0369a1;text-decoration:underline;word-break:break-all;">${escapeHtml(ticketUrl)}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:18px 0 0;font-size:14px;color:#334155;">Kid-friendly reminder: bring your biggest smile, comfy shoes, and a heart ready for fun.</p>
    <p style="margin:8px 0 0;font-size:13px;color:#475569;">Questions? Email <a href="mailto:${escapeHtml(helpEmailAddress())}" style="color:#2563eb;">${escapeHtml(helpEmailAddress())}</a>.</p>
  `;

  const { result, error } = await sendHtml(
    guardian.email.trim(),
    gname,
    `${brandName()} — Confirmed: VBS registration for ${childName.split(" ")[0]}`,
    emailShell(inner),
    [
      ...(logo ? [logo.attachment] : []),
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
  const logo = await loadThemeLogoInlineAttachment();
  if (logo) attachments.push(logo.attachment);
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
  const seasonTitle = confirmedWithIdentity[0]?.season?.name?.trim() || "VBS";
  const inner = `
    ${
      logo
        ? `<p style="margin:-18px 0 8px;text-align:center;line-height:0;font-size:0;"><img src="cid:${logo.cid}" width="300" alt="Illumination Station" style="max-width:100%;height:auto;border:0;display:block;margin:0 auto;" /></p>`
        : ""
    }
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0ea5e9;">VBS Confirmation</p>
    <h2 style="margin:0 0 8px;font-size:26px;line-height:1.2;font-weight:800;color:#0f172a;">You&apos;re all set for ${escapeHtml(seasonTitle)}!</h2>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.45;color:#0f766e;"><strong>Shining a light on who Jesus really is - John 8:12</strong></p>
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 14px;">Your confirmed registrations are ready. Each child&apos;s digital card is below:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${blocks}</table>
    <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Save this email and show each QR code at check-in. We can&apos;t wait to see your family!</p>
    <p style="margin:8px 0 0;font-size:13px;color:#475569;">Questions? Email <a href="mailto:${escapeHtml(helpEmailAddress())}" style="color:#2563eb;">${escapeHtml(helpEmailAddress())}</a>.</p>
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

function buildRegistrationCancelledEmailInner(args: {
  guardianName: string;
  seasonName: string;
  childListHtml: string;
  registerUrl: string;
}): string {
  const contact = helpEmailAddress();
  const season = escapeHtml(args.seasonName);
  const registerUrl = escapeHtml(args.registerUrl);

  return `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(args.guardianName)},</p>
    <p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:14px;line-height:1.55;">
      Your VBS registration for <strong>${season}</strong> has been <strong>cancelled</strong> by our team.
      ${args.childListHtml}
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">
      This is often because <strong>payment was not completed</strong> on this submission, or because we found a
      <strong>duplicate or overlapping registration</strong> for the same child and payment was already received on
      another submission. If you still need to register and pay, please <strong>submit a new registration</strong> and
      complete the card payment step when prompted.
    </p>
    <p style="margin:0 0 16px;">
      <a href="${registerUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-size:14px;line-height:1.1;font-weight:700;border:1px solid #0b5f58;">Register again</a>
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#475569;">
      If you believe this cancellation was made in error, please contact us immediately at
      <a href="mailto:${escapeHtml(contact)}" style="color:#2563eb;font-weight:600;">${escapeHtml(contact)}</a>.
    </p>
  `;
}

function childListBlockHtml(
  registrations: Array<{ child: { firstName: string; lastName: string } }>,
): string {
  if (registrations.length === 0) return "";
  const items = registrations
    .map((r) => {
      const n = `${r.child.firstName} ${r.child.lastName}`.trim();
      return n
        ? `<li style="margin:0 0 6px;"><strong>${escapeHtml(n)}</strong></li>`
        : `<li style="margin:0 0 6px;">Child registration</li>`;
    })
    .join("");
  return `
    <p style="margin:12px 0 6px;font-size:14px;font-weight:600;color:#7f1d1d;">Affected registration(s)</p>
    <ul style="margin:0;padding-left:20px;color:#991b1b;font-size:14px;line-height:1.5;">
      ${items}
    </ul>`;
}

/** After admin declines or cancels a single registration. */
export async function sendRegistrationCancelledEmail(registrationId: string): Promise<EmailSendResult> {
  const reg = await loadRegistrationForEmail(registrationId);
  if (!reg) return "skipped_no_email";
  if (reg.status !== "CANCELLED") return "skipped_ineligible";

  const guardian = reg.child.guardian;
  if (!guardian?.email?.trim()) return "skipped_no_email";

  const gname = `${guardian.firstName} ${guardian.lastName}`.trim();
  const childName = `${reg.child.firstName} ${reg.child.lastName}`.trim();
  const registerUrl = `${getPublicAppBaseUrl()}/register`;
  const childListHtml = childListBlockHtml([{ child: reg.child }]);

  const inner = buildRegistrationCancelledEmailInner({
    guardianName: gname,
    seasonName: reg.season.name,
    childListHtml,
    registerUrl,
  });

  const subjectChild = childName.split(" ")[0] || "your child";
  const { result, error } = await sendHtml(
    guardian.email.trim(),
    gname,
    `${brandName()} — Registration cancelled (${subjectChild})`,
    emailShell(inner),
  );

  if (result === "failed") console.error("[registration email cancelled]", error);
  if (result === "sent") return "sent";
  if (result === "skipped_no_graph") return "skipped_no_graph";
  return "failed";
}

/**
 * After admin cancels all (or selected) registrations on a form submission — one email to the guardian.
 */
export async function sendSubmissionCancelledEmail(
  submissionId: string,
  registrationIds?: string[],
): Promise<EmailSendResult> {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      guardian: true,
      season: true,
      registrations: {
        where: {
          status: "CANCELLED",
          ...(registrationIds?.length ? { id: { in: registrationIds } } : {}),
        },
        include: { child: true },
      },
    },
  });
  if (!submission?.guardian.email?.trim()) return "skipped_no_email";
  if (submission.registrations.length === 0) return "skipped_ineligible";

  const gname = `${submission.guardian.firstName} ${submission.guardian.lastName}`.trim();
  const registerUrl = `${getPublicAppBaseUrl()}/register`;
  const childListHtml = childListBlockHtml(submission.registrations);

  const inner = buildRegistrationCancelledEmailInner({
    guardianName: gname,
    seasonName: submission.season.name,
    childListHtml,
    registerUrl,
  });

  const { result, error } = await sendHtml(
    submission.guardian.email.trim(),
    gname,
    `${brandName()} — Registration cancelled`,
    emailShell(inner),
  );

  if (result === "failed") console.error("[registration email submission cancelled]", error);
  if (result === "sent") return "sent";
  if (result === "skipped_no_graph") return "skipped_no_graph";
  return "failed";
}

export function formatCancellationEmailHint(result: EmailSendResult): string {
  if (result === "sent") return " Cancellation notice emailed to the guardian.";
  if (result === "skipped_no_graph") return " (Email not configured — notify the family manually.)";
  if (result === "skipped_no_email") return " (No guardian email — could not send cancellation notice.)";
  if (result === "skipped_ineligible") return "";
  return " (Cancellation email failed — check server logs.)";
}

export function formatCheckoutReminderEmailHint(result: EmailSendResult): string {
  if (result === "sent") return " Checkout reminder emailed.";
  if (result === "skipped_no_graph") return " (Email not configured.)";
  if (result === "skipped_no_email") return " (No guardian email.)";
  if (result === "skipped_ineligible") return " (Not checkout pending or already paid.)";
  return " (Checkout reminder email failed — check server logs.)";
}

/** Remind guardian to finish an open Stripe Checkout session (resume link + self-cancel). */
export async function sendCheckoutReminderEmail(formSubmissionId: string): Promise<EmailSendResult> {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: formSubmissionId },
    include: {
      guardian: true,
      season: true,
      registrations: {
        where: { status: { not: "CANCELLED" } },
        include: { child: true },
      },
    },
  });
  if (!submission?.guardian.email?.trim()) return "skipped_no_email";

  const sampleReg = submission.registrations[0];
  if (!sampleReg) return "skipped_ineligible";

  const pending = isCheckoutPendingRegistration({
    paymentReceivedAt: sampleReg.paymentReceivedAt,
    expectsPayment: sampleReg.expectsPayment,
    formSubmission: {
      stripePaymentStatus: submission.stripePaymentStatus,
      stripeCheckoutSessionId: submission.stripeCheckoutSessionId,
    },
  });
  if (!pending) return "skipped_ineligible";

  const resume = await resolveCheckoutResumeUrlForSubmission(formSubmissionId);
  if ("error" in resume) {
    console.error("[checkout reminder] resume url", resume.error);
    return "failed";
  }

  const cancelToken = signSubmissionPublicToken(formSubmissionId, "cancel");
  if (!cancelToken) {
    console.error("[checkout reminder] missing AUTH_SECRET for cancel link");
    return "failed";
  }

  const base = getPublicAppBaseUrl();
  const checkoutUrl = escapeHtml(resume.url);
  const cancelUrl = escapeHtml(submissionCancelUrl(cancelToken, base));
  const contact = helpEmailAddress();
  const gname = `${submission.guardian.firstName} ${submission.guardian.lastName}`.trim();
  const season = escapeHtml(submission.season.name);
  const code = escapeHtml(submission.registrationCode);

  const childLines = submission.registrations
    .map((r) => {
      const n = `${r.child.firstName} ${r.child.lastName}`.trim();
      return n
        ? `<li style="margin:0 0 6px;"><strong>${escapeHtml(n)}</strong></li>`
        : `<li style="margin:0 0 6px;">Child registration</li>`;
    })
    .join("");

  const inner = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:14px;line-height:1.55;">
      Your VBS registration for <strong>${season}</strong> (reference <strong>${code}</strong>) is saved, but
      <strong>card payment is not finished yet</strong>. Use the button below to return to secure checkout and pay where you left off.
    </p>
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a;">Children on this registration</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#334155;font-size:15px;line-height:1.5;">
      ${childLines || `<li>Your registered children</li>`}
    </ul>
    <p style="margin:0 0 12px;">
      <a href="${checkoutUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-size:14px;line-height:1.1;font-weight:700;border:1px solid #0b5f58;">Complete payment</a>
    </p>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;">
      If the button does not open, copy this link into your browser:<br/>
      <a href="${checkoutUrl}" style="color:#0369a1;word-break:break-all;">${checkoutUrl}</a>
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#475569;">
      No longer planning to attend? You may
      <a href="${cancelUrl}" style="color:#b45309;font-weight:600;">cancel this registration</a>
      and we will mark it withdrawn.
    </p>
    <p style="margin:0;font-size:14px;color:#475569;">
      Questions? Email <a href="mailto:${escapeHtml(contact)}" style="color:#2563eb;">${escapeHtml(contact)}</a>.
    </p>
  `;

  const { result, error } = await sendHtml(
    submission.guardian.email.trim(),
    gname,
    `${brandName()} — Complete your VBS payment`,
    emailShell(inner),
  );

  if (result === "failed") console.error("[registration email checkout reminder]", error);
  if (result === "sent") {
    await prisma.formSubmission.update({
      where: { id: formSubmissionId },
      data: { stripeCheckoutReminderSentAt: new Date() },
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
  const contact = helpEmailAddress();

  const inner = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(gname)},</p>
    <p style="margin:0 0 16px;">This is a friendly reminder about the program fee for <strong>${escapeHtml(childName)}</strong>’s registration <strong>${num}</strong> for <strong>${season}</strong>.</p>
    <p style="margin:0 0 16px;">If you’ve already paid, thank you — you can disregard this message.</p>
    ${
      contact
        ? `<p style="margin:0;font-size:14px;color:#475569;">Questions? Please email <a href="mailto:${escapeHtml(contact)}" style="color:#2563eb;">${escapeHtml(contact)}</a>.</p>`
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
