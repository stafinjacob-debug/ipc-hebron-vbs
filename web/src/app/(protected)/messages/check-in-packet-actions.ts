"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  COMPOSE_TO_EMAIL_RE,
  parseComposeRegistrantAudience,
  recipientsForCheckInPacketAudience,
  statsForCheckInPacketAudience,
} from "@/lib/compose-registrant-audience";
import {
  sendCheckInPacketEmail,
  type CheckInPacketAttachment,
} from "@/lib/email/check-in-packet-email";
import {
  loadRegistrationEmailContext,
  registrationContactFooterInput,
} from "@/lib/email/registration-email-context";
import { isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";
import { plainTextEmailBodyToHtml } from "@/lib/email/plain-text-email-html";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";

export type CheckInPacketActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const MAX_CHECK_IN_PACKET_RECIPIENTS = 1000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function sanitizeAttachmentFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop()?.trim() || "attachment";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120);
  return cleaned || "attachment";
}

async function parseCheckInPacketAttachment(
  formData: FormData,
): Promise<{ ok: true; attachment: CheckInPacketAttachment | null } | { ok: false; error: string }> {
  const file = formData.get("attachment");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: true, attachment: null };
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "Attachment must be 10 MB or smaller." };
  }

  const contentType = file.type.trim() || "application/octet-stream";
  if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
    return {
      ok: false,
      error: "Attachment must be a PDF, PNG, JPEG, WebP, DOC, or DOCX file.",
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    attachment: {
      fileName: sanitizeAttachmentFileName(file.name),
      contentType,
      contentBytesBase64: bytes.toString("base64"),
    },
  };
}

export async function previewCheckInPacketAudienceAction(
  seasonId: string,
  audienceRaw: string,
): Promise<
  | {
      ok: true;
      recipientCount: number;
      matchingRegistrations: number;
      skippedNoEmail: number;
      skippedNoCheckInIdentity: number;
      eligibleChildren: number;
    }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, error: "You do not have permission to preview recipients." };
  }

  const season = seasonId.trim();
  if (!season) return { ok: false, error: "Choose a season." };

  const audience = parseComposeRegistrantAudience(audienceRaw);
  if (!audience) return { ok: false, error: "Choose a registrant group." };

  const stats = await statsForCheckInPacketAudience(season, audience);
  return { ok: true, ...stats };
}

async function loadCheckInPacketSendContext(seasonId: string) {
  const emailCtx = await loadRegistrationEmailContext(seasonId);
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: { publicRegistrationSlug: true, name: true },
  });
  return {
    portal: { publicRegistrationSlug: season?.publicRegistrationSlug ?? null },
    fromName: season?.name?.trim() || null,
    contactFooter: emailCtx ? registrationContactFooterInput(emailCtx) : null,
  };
}

export async function sendCheckInPacketTestAction(
  _prevState: CheckInPacketActionState,
  formData: FormData,
): Promise<CheckInPacketActionState> {
  void _prevState;

  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, error: "You do not have permission to send check-in packets." };
  }

  if (!isMicrosoftGraphEmailConfigured()) {
    return { ok: false, error: "Microsoft Graph email is not configured on the server." };
  }

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const audienceRaw = String(formData.get("registrantAudience") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const testTo = String(formData.get("testTo") ?? "").trim();

  if (!seasonId) return { ok: false, error: "Choose a season." };
  if (!subject) return { ok: false, error: "Subject is required." };
  if (!testTo || !COMPOSE_TO_EMAIL_RE.test(testTo)) {
    return { ok: false, error: "Enter a valid test email address." };
  }

  const audience = parseComposeRegistrantAudience(audienceRaw);
  if (!audience) return { ok: false, error: "Choose a registrant group." };

  const attachmentResult = await parseCheckInPacketAttachment(formData);
  if (!attachmentResult.ok) return { ok: false, error: attachmentResult.error };

  const { recipients } = await recipientsForCheckInPacketAudience(seasonId, audience);
  if (recipients.length === 0) {
    return {
      ok: false,
      error:
        "No families with check-in cards match this group, so there is no sample packet to send. Confirm registrations first.",
    };
  }

  const sample = recipients[0]!;
  const { portal, fromName, contactFooter } = await loadCheckInPacketSendContext(seasonId);
  const testSubject = subject.startsWith("[TEST]") ? subject : `[TEST] ${subject}`;
  const testBanner =
    `<p style="margin:0 0 14px;padding:10px 12px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:14px;">` +
    `<strong>Test send only.</strong> This uses sample check-in cards from ` +
    `${sample.guardianName} (${sample.children.length} child card${sample.children.length === 1 ? "" : "s"}). ` +
    `Families were not emailed.</p>`;
  const introHtml = `${testBanner}${plainTextEmailBodyToHtml(body)}`;

  const result = await sendCheckInPacketEmail({
    recipient: {
      email: testTo,
      guardianName: sample.guardianName,
      children: sample.children,
    },
    subject: testSubject,
    introHtml,
    attachment: attachmentResult.attachment,
    portal,
    fromName,
    contactFooter,
  });

  if (!result.ok) {
    return { ok: false, error: result.error || "Could not send the test check-in packet." };
  }

  revalidatePath("/messages/sent");
  revalidatePath("/messages/check-in-packet");

  const attachNote = attachmentResult.attachment
    ? ` Attachment "${attachmentResult.attachment.fileName}" included.`
    : "";
  return {
    ok: true,
    message: `Test check-in packet sent to ${testTo} (sample: ${sample.guardianName}, ${sample.children.length} child card${sample.children.length === 1 ? "" : "s"}).${attachNote}`,
  };
}

export async function sendCheckInPacketAction(
  _prevState: CheckInPacketActionState,
  formData: FormData,
): Promise<CheckInPacketActionState> {
  void _prevState;

  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, error: "You do not have permission to send check-in packets." };
  }

  if (!isMicrosoftGraphEmailConfigured()) {
    return { ok: false, error: "Microsoft Graph email is not configured on the server." };
  }

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const audienceRaw = String(formData.get("registrantAudience") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!seasonId) return { ok: false, error: "Choose a season." };
  if (!subject) return { ok: false, error: "Subject is required." };

  const audience = parseComposeRegistrantAudience(audienceRaw);
  if (!audience) return { ok: false, error: "Choose a registrant group." };

  const attachmentResult = await parseCheckInPacketAttachment(formData);
  if (!attachmentResult.ok) return { ok: false, error: attachmentResult.error };

  const { recipients, stats } = await recipientsForCheckInPacketAudience(seasonId, audience);
  const { portal, fromName, contactFooter } = await loadCheckInPacketSendContext(seasonId);
  if (recipients.length === 0) {
    return {
      ok: false,
      error:
        "No families with check-in cards match this group. Confirm registrations and ensure each child has a registration number and QR token.",
    };
  }
  if (recipients.length > MAX_CHECK_IN_PACKET_RECIPIENTS) {
    return {
      ok: false,
      error: `Too many recipients (${recipients.length}). Narrow the group or split into smaller sends (max ${MAX_CHECK_IN_PACKET_RECIPIENTS}).`,
    };
  }

  const introHtml = plainTextEmailBodyToHtml(body);
  let sent = 0;
  let failed = 0;
  let lastError = "";

  for (const recipient of recipients) {
    const result = await sendCheckInPacketEmail({
      recipient,
      subject,
      introHtml,
      attachment: attachmentResult.attachment,
      portal,
      fromName,
      contactFooter,
    });
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      lastError = result.error;
    }
  }

  revalidatePath("/messages");
  revalidatePath("/messages/sent");
  revalidatePath("/messages/check-in-packet");

  if (sent === 0) {
    return { ok: false, error: lastError || "Could not send check-in packets." };
  }

  const skipNotes: string[] = [];
  if (stats.skippedNoEmail > 0) {
    skipNotes.push(`${stats.skippedNoEmail} registration(s) skipped (no valid guardian email)`);
  }
  if (stats.skippedNoCheckInIdentity > 0) {
    skipNotes.push(
      `${stats.skippedNoCheckInIdentity} registration(s) skipped (missing registration # or check-in token)`,
    );
  }
  const skipNote = skipNotes.length ? ` ${skipNotes.join("; ")}.` : "";
  const failNote = failed > 0 ? ` ${failed} failed.` : "";
  const attachNote = attachmentResult.attachment
    ? ` Each email included "${attachmentResult.attachment.fileName}".`
    : "";

  return {
    ok: true,
    message: `Sent check-in packets to ${sent} famil${sent === 1 ? "y" : "ies"} (${stats.eligibleChildren} child check-in card${stats.eligibleChildren === 1 ? "" : "s"}).${attachNote}${failNote}${skipNote}`,
  };
}
