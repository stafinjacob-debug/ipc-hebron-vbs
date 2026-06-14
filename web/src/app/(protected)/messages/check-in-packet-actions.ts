"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  parseComposeRegistrantAudience,
  recipientsForCheckInPacketAudience,
  statsForCheckInPacketAudience,
} from "@/lib/compose-registrant-audience";
import {
  sendCheckInPacketEmail,
  type CheckInPacketAttachment,
} from "@/lib/email/check-in-packet-email";
import { isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";

export type CheckInPacketActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const MAX_CHECK_IN_PACKET_RECIPIENTS = 1000;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function escapeHtmlEmailBody(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function introHtmlFromPlainText(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#0f172a">${escapeHtmlEmailBody(trimmed).replace(/\r?\n/g, "<br/>")}</div>`;
}

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
    return { ok: false, error: "Attachment must be 3 MB or smaller." };
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
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: { publicRegistrationSlug: true },
  });
  const portal = { publicRegistrationSlug: season?.publicRegistrationSlug ?? null };
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

  const introHtml = introHtmlFromPlainText(body);
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
