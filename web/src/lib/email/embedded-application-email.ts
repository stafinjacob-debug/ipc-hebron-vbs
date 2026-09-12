import { prisma } from "@/lib/prisma";
import { isMicrosoftGraphEmailConfigured, sendMailViaMicrosoftGraph } from "@/lib/email/microsoft-graph";
import {
  applicantVisibleSections,
  fieldsForEmbeddedSection,
  isFillableEmbeddedField,
  parseEmbeddedFormDefinitionJson,
} from "@/lib/embedded-form-definition";
import { responseToDisplayString } from "@/lib/embedded-form-validate";
import { embeddedPdfFilename, renderEmbeddedApplicationPdf } from "@/lib/embedded-form-pdf";
import { formatUsdFromCents } from "@/lib/stripe-fee-math";
import { HTC_FORM_DEFAULTS } from "@/lib/embedded-form-htc-template";

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

function stripeDetailRows(submission: {
  stripePaymentStatus: string | null;
  stripePaidAt: Date | null;
  stripeAmountChargedCents: number | null;
  stripeBaseCents: number | null;
  stripeProcessingCents: number | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
}): Array<[string, string]> {
  const status = submission.stripePaymentStatus?.trim() || "not started";
  const rows: Array<[string, string]> = [
    ["Payment status", status === "paid" ? "Paid" : status],
  ];
  if (submission.stripePaidAt) {
    rows.push(["Paid at", submission.stripePaidAt.toISOString()]);
  }
  if (submission.stripeBaseCents != null) {
    rows.push(["Application fee", formatUsdFromCents(submission.stripeBaseCents)]);
  }
  if (submission.stripeProcessingCents != null && submission.stripeProcessingCents > 0) {
    rows.push(["Card processing (included)", formatUsdFromCents(submission.stripeProcessingCents)]);
  }
  if (submission.stripeAmountChargedCents != null) {
    rows.push(["Amount charged", formatUsdFromCents(submission.stripeAmountChargedCents)]);
  }
  if (submission.stripeCheckoutSessionId) {
    rows.push(["Stripe Checkout session", submission.stripeCheckoutSessionId]);
  }
  if (submission.stripePaymentIntentId) {
    rows.push(["Stripe PaymentIntent", submission.stripePaymentIntentId]);
  }
  return rows;
}

function kvTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(k)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;white-space:pre-wrap;">${escapeHtml(v || "—")}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${body}</table>`;
}

function responsesHtml(
  definitionJson: string | null | undefined,
  responses: Record<string, unknown>,
): string {
  const def = parseEmbeddedFormDefinitionJson(definitionJson);
  if (!def) {
    const fallback = Object.entries(responses)
      .filter(([, v]) => responseToDisplayString(v).trim())
      .map(([k, v]) => [k, responseToDisplayString(v)] as [string, string]);
    return kvTable(fallback);
  }

  const skip = new Set(["passportPhoto", "academicDocuments", "declarationText", "applicationFeeNote"]);
  const parts: string[] = [];
  for (const section of applicantVisibleSections(def)) {
    const fields = fieldsForEmbeddedSection(def, section.id).filter(
      (f) => isFillableEmbeddedField(f) && !skip.has(f.key) && f.type !== "photo" && f.type !== "documentUploads",
    );
    if (!fields.length) continue;
    const rows = fields.map((f) => [f.label, responseToDisplayString(responses[f.key])] as [string, string]);
    parts.push(
      `<h3 style="margin:18px 0 8px;font-size:14px;color:#312e81;">${escapeHtml(section.title)}</h3>${kvTable(rows)}`,
    );
  }
  return parts.join("");
}

/** Staff copy: every answer, Stripe tracking, and the filled PDF. Recipient is form.notificationEmail. */
export async function sendEmbeddedApplicationStaffNotificationEmail(
  submissionId: string,
): Promise<EmbeddedEmailSendResult> {
  const submission = await prisma.embeddedFormSubmission.findUnique({
    where: { id: submissionId },
    include: { form: true },
  });
  if (!submission) return "skipped_no_email";

  const to =
    submission.form.notificationEmail?.trim() ||
    submission.form.helpEmail?.trim() ||
    HTC_FORM_DEFAULTS.notificationEmail;
  if (!to) return "skipped_no_email";
  if (!isMicrosoftGraphEmailConfigured()) return "skipped_no_graph";

  const form = submission.form;
  const brandName = form.emailFromName?.trim() || form.title || "Admissions";
  const responses = (submission.responsesJson ?? {}) as Record<string, unknown>;
  const registrar = (submission.registrarResponsesJson ?? null) as Record<string, unknown> | null;

  let pdfAttachment:
    | { name: string; contentType: string; contentBytesBase64: string }
    | null = null;
  try {
    const pdf = await renderEmbeddedApplicationPdf({
      templateKey: form.pdfTemplateKey || HTC_FORM_DEFAULTS.pdfTemplateKey,
      applicationNumber: submission.applicationNumber,
      responses,
      registrarResponses: registrar,
      photoObjectKey: submission.photoObjectKey,
      signatureTypedName: submission.signatureTypedName,
      applicantFullName: submission.applicantFullName,
    });
    pdfAttachment = {
      name: embeddedPdfFilename(submission.applicantFullName, submission.applicationNumber),
      contentType: "application/pdf",
      contentBytesBase64: pdf.toString("base64"),
    };
  } catch (e) {
    console.error("[embedded staff notification pdf]", e);
  }

  const stripeRows = stripeDetailRows(submission);
  const inner = `
    <p style="margin:0 0 14px;">A new application was submitted for <strong>${escapeHtml(form.title)}</strong>.</p>
    <p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;color:#312e81;font-size:14px;">
      Reference <strong>${escapeHtml(submission.applicationNumber)}</strong><br />
      Applicant <strong>${escapeHtml(submission.applicantFullName)}</strong><br />
      ${escapeHtml(submission.applicantEmail)}${submission.applicantPhone ? ` · ${escapeHtml(submission.applicantPhone)}` : ""}
    </p>
    <h3 style="margin:0 0 8px;font-size:14px;color:#312e81;">Stripe transaction</h3>
    ${kvTable(stripeRows)}
    <p style="margin:16px 0 0;font-size:13px;color:#475569;">
      ${pdfAttachment ? "The filled application PDF is attached." : "The filled PDF could not be generated; export it from the admin submission page."}
      Academic document files stay in the admin portal.
    </p>
    <h3 style="margin:22px 0 8px;font-size:14px;color:#312e81;">Field responses</h3>
    ${responsesHtml(submission.definitionSnapshotJson, responses)}
  `;

  const html = applicationEmailShell({
    brandName,
    subtitle: "New application",
    inner,
    teamPhrase: `${brandName} admissions`,
  });

  const result = await sendMailViaMicrosoftGraph({
    toAddress: to,
    toName: "Admissions",
    subject: `New application — ${submission.applicantFullName} — ${submission.applicationNumber}`,
    htmlBody: html,
    fromName: brandName,
    attachments: pdfAttachment ? [pdfAttachment] : undefined,
  });

  if (result.ok) {
    await prisma.embeddedFormSubmission.update({
      where: { id: submissionId },
      data: { staffNotificationEmailSentAt: new Date() },
    });
    return "sent";
  }

  console.error("[embedded staff notification email]", result.error);
  return "failed";
}

/** Applicant receipt + staff copy (PDF + Stripe). Skips a message that already went out. */
export async function sendEmbeddedApplicationFollowUpEmails(submissionId: string): Promise<void> {
  const submission = await prisma.embeddedFormSubmission.findUnique({
    where: { id: submissionId },
    select: {
      applicationReceivedEmailSentAt: true,
      staffNotificationEmailSentAt: true,
    },
  });
  if (!submission) return;

  if (!submission.applicationReceivedEmailSentAt) {
    await sendEmbeddedApplicationReceivedEmail(submissionId).catch((err) => {
      console.error("[embedded follow-up applicant email]", err);
    });
  }
  if (!submission.staffNotificationEmailSentAt) {
    await sendEmbeddedApplicationStaffNotificationEmail(submissionId).catch((err) => {
      console.error("[embedded follow-up staff email]", err);
    });
  }
}
