import { prisma } from "@/lib/prisma";
import { isMicrosoftGraphEmailConfigured, sendMailViaMicrosoftGraph } from "@/lib/email/microsoft-graph";

export type EmbeddedEmailSendResult = "sent" | "failed" | "skipped_no_email" | "skipped_no_graph";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applicationEmailShell(args: {
  brandName: string;
  subtitle: string;
  inner: string;
  teamPhrase: string;
}): string {
  const brand = escapeHtml(args.brandName);
  const subtitle = escapeHtml(args.subtitle);
  const team = escapeHtml(args.teamPhrase);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${brand}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:0;height:6px;background:#4f46e5;"></td>
          </tr>
          <tr>
            <td
              bgcolor="#312e81"
              align="center"
              style="background-color:#312e81;background-image:linear-gradient(120deg,#3730a3 0%,#4f46e5 55%,#6366f1 100%);padding:22px 24px;text-align:center;"
            >
              <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#e0e7ff;">
                ${subtitle}
              </p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">
                ${brand}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 28px;color:#334155;font-size:16px;line-height:1.6;">
              ${args.inner}
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;text-align:center;font-size:12px;color:#94a3b8;">
              This message was sent by ${team}. Please do not reply if you were not expecting it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Distinct from event/registration emails — application received acknowledgment. */
export async function sendEmbeddedApplicationReceivedEmail(
  submissionId: string,
): Promise<EmbeddedEmailSendResult> {
  const submission = await prisma.embeddedFormSubmission.findUnique({
    where: { id: submissionId },
    include: { form: true },
  });
  if (!submission) return "skipped_no_email";
  const to = submission.applicantEmail?.trim();
  if (!to) return "skipped_no_email";

  if (!isMicrosoftGraphEmailConfigured()) return "skipped_no_graph";

  const form = submission.form;
  const brandName = form.emailFromName?.trim() || form.title || "Admissions";
  const subtitle = form.subtitle?.trim() || "Application";
  const helpEmail = form.helpEmail?.trim() || process.env.VBS_HELP_EMAIL?.trim() || "";
  const helpPhone = form.helpPhone?.trim() || "";
  const subject =
    form.emailSubject?.trim() ||
    `Application received — ${brandName}`;

  const contactBits = [
    helpEmail ? `Email: ${escapeHtml(helpEmail)}` : "",
    helpPhone ? `Phone: ${escapeHtml(helpPhone)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const inner = `
    <p style="margin:0 0 14px;">Dear ${escapeHtml(submission.applicantFullName)},</p>
    <p style="margin:0 0 14px;">
      Thank you for submitting your application for <strong>${escapeHtml(form.title)}</strong>${
        form.subtitle ? ` (<strong>${escapeHtml(form.subtitle)}</strong>)` : ""
      }.
    </p>
    <p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;color:#312e81;font-size:14px;">
      Your application reference number is <strong>${escapeHtml(submission.applicationNumber)}</strong>.
    </p>
    <p style="margin:0 0 14px;">
      We have received your application. Someone from our team will review it and contact you using the email or phone number you provided.
    </p>
    <p style="margin:0 0 14px;">
      You do not need to take any further action unless we request additional documents.
    </p>
    ${
      contactBits
        ? `<p style="margin:0;font-size:14px;color:#475569;">If you have questions, contact us at ${contactBits}.</p>`
        : ""
    }
  `;

  const html = applicationEmailShell({
    brandName,
    subtitle,
    inner,
    teamPhrase: `${brandName} admissions team`,
  });

  const result = await sendMailViaMicrosoftGraph({
    toAddress: to,
    toName: submission.applicantFullName,
    subject,
    htmlBody: html,
    fromName: brandName,
  });

  if (result.ok) {
    await prisma.embeddedFormSubmission.update({
      where: { id: submissionId },
      data: { applicationReceivedEmailSentAt: new Date() },
    });
    return "sent";
  }

  console.error("[embedded application email]", result.error);
  return "failed";
}
