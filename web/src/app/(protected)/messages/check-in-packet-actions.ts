"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  COMPOSE_TO_EMAIL_RE,
  parseComposeRegistrantAudience,
  recipientsForCheckInPacketAudience,
  statsForCheckInPacketAudience,
  type CheckInPacketRecipient,
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
import { makeCheckInToken } from "@/lib/registration-identity";
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
    select: { publicRegistrationSlug: true, name: true, year: true },
  });
  const seasonName = season?.name?.trim() || emailCtx?.eventName?.trim() || "VBS";
  return {
    portal: { publicRegistrationSlug: season?.publicRegistrationSlug ?? null },
    fromName: seasonName,
    eventName: seasonName,
    teamPhrase: emailCtx?.teamPhrase ?? null,
    seasonName,
    seasonYear: season?.year ?? new Date().getFullYear(),
    contactFooter: emailCtx ? registrationContactFooterInput(emailCtx) : null,
  };
}

/** Prefer audience match, then any season card, then a synthetic demo packet for layout tests. */
async function resolveCheckInPacketTestSample(
  seasonId: string,
  audience: NonNullable<ReturnType<typeof parseComposeRegistrantAudience>>,
): Promise<{
  recipient: CheckInPacketRecipient;
  source: "audience" | "season" | "demo";
}> {
  const { recipients } = await recipientsForCheckInPacketAudience(seasonId, audience);
  if (recipients[0]) {
    return { recipient: recipients[0], source: "audience" };
  }

  const row = await prisma.registration.findFirst({
    where: {
      seasonId,
      registrationNumber: { not: null },
      checkInToken: { not: null },
      child: { guardian: { email: { not: null } } },
    },
    select: {
      registrationNumber: true,
      checkInToken: true,
      status: true,
      child: {
        select: {
          firstName: true,
          lastName: true,
          guardian: { select: { email: true, firstName: true, lastName: true } },
        },
      },
      classroom: { select: { name: true } },
      season: { select: { name: true } },
    },
    orderBy: [{ child: { firstName: "asc" } }],
  });

  const registrationNumber = row?.registrationNumber?.trim() ?? "";
  const checkInToken = row?.checkInToken?.trim() ?? "";
  const email = row?.child.guardian.email?.trim() ?? "";
  if (row && registrationNumber && checkInToken && email && COMPOSE_TO_EMAIL_RE.test(email)) {
    const guardian = row.child.guardian;
    return {
      source: "season",
      recipient: {
        email,
        guardianName: `${guardian.firstName} ${guardian.lastName}`.trim() || email,
        children: [
          {
            firstName: row.child.firstName,
            lastName: row.child.lastName,
            registrationNumber,
            checkInToken,
            status: row.status,
            classroomName: row.classroom?.name ?? null,
            seasonName: row.season.name,
          },
        ],
      },
    };
  }

  const ctx = await loadCheckInPacketSendContext(seasonId);
  return {
    source: "demo",
    recipient: {
      email: "demo@example.com",
      guardianName: "Sample Parent",
      children: [
        {
          firstName: "Sample",
          lastName: "Child",
          registrationNumber: `TEST-${ctx.seasonYear}-001`,
          checkInToken: makeCheckInToken(),
          status: "CONFIRMED",
          classroomName: "Sample Class",
          seasonName: ctx.seasonName,
        },
      ],
    },
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

  const sample = await resolveCheckInPacketTestSample(seasonId, audience);
  const { portal, fromName, eventName, teamPhrase, contactFooter } =
    await loadCheckInPacketSendContext(seasonId);
  const testSubject = subject.startsWith("[TEST]") ? subject : `[TEST] ${subject}`;

  const sourceNote =
    sample.source === "demo"
      ? "This uses a demo check-in card (no matching families with QR tokens yet)."
      : sample.source === "season"
        ? `No cards in the selected group — using a sample from another family in this season (${sample.recipient.guardianName}).`
        : `This uses sample check-in cards from ${sample.recipient.guardianName} (${sample.recipient.children.length} child card${sample.recipient.children.length === 1 ? "" : "s"}).`;

  const testBanner =
    `<p style="margin:0 0 14px;padding:10px 12px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:14px;">` +
    `<strong>Test send only.</strong> ${sourceNote} Families were not emailed.</p>`;
  const introHtml = `${testBanner}${plainTextEmailBodyToHtml(body)}`;

  const result = await sendCheckInPacketEmail({
    recipient: {
      email: testTo,
      guardianName: sample.recipient.guardianName,
      children: sample.recipient.children,
    },
    subject: testSubject,
    introHtml,
    attachment: attachmentResult.attachment,
    portal,
    fromName,
    eventName,
    teamPhrase,
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
  const sampleNote =
    sample.source === "demo"
      ? "demo check-in card"
      : `${sample.recipient.guardianName}, ${sample.recipient.children.length} child card${sample.recipient.children.length === 1 ? "" : "s"}`;
  return {
    ok: true,
    message: `Test check-in packet sent to ${testTo} (sample: ${sampleNote}).${attachNote}`,
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
  const { portal, fromName, eventName, teamPhrase, contactFooter } =
    await loadCheckInPacketSendContext(seasonId);
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
      eventName,
      teamPhrase,
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
