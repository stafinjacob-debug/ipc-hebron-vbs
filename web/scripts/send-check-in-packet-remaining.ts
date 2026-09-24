/**
 * Send UNITED ‘26 check-in packets to remaining all-active families
 * who were not in the earlier bulk of 14. Reuses subject/body/PDF from Sent Items.
 *
 * Required env: DATABASE_URL, MICROSOFT_GRAPH_*, CONFIRM_SEND=yes
 * Optional: DRY_RUN=1 (list only, no send)
 */
import { prisma } from "../src/lib/prisma";
import { recipientsForCheckInPacketAudience } from "../src/lib/compose-registrant-audience";
import {
  sendCheckInPacketEmail,
  type CheckInPacketAttachment,
} from "../src/lib/email/check-in-packet-email";
import {
  loadRegistrationEmailContext,
  registrationContactFooterInput,
} from "../src/lib/email/registration-email-context";

/** Families who already received the bulk UNITED ‘26 check-in packet today. */
const ALREADY_SENT = new Set(
  [
    "mathew.joshua@gmail.com",
    "jobyt3@gmail.com",
    "jomon3@outlook.com",
    "litty27@hotmail.com",
    "wtmathew@gmail.com",
    "bencyab@hotmail.com",
    "andrewbabu06@gmail.com",
    "jomy.george26@gmail.com",
    "wvarkey@gmail.com",
    "alanjohngeorge75@gmail.com",
    "biju360@yahoo.com",
    "cbcofjc@sbcglobal.net",
    "jbkuriyan@gmail.com",
    "gbewin@yahoo.com",
  ].map((e) => e.toLowerCase()),
);

async function getToken() {
  const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_GRAPH_CLIENT_SECRET?.trim();
  if (!tenantId || !clientId || !clientSecret) throw new Error("Graph env missing");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error_description || `token ${res.status}`);
  return json.access_token;
}

async function loadTemplateFromSentItems(token: string, mailbox: string) {
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}`;
  const listRes = await fetch(
    `${base}/mailFolders/sentitems/messages?$top=40&$orderby=sentDateTime desc` +
      `&$select=id,subject,sentDateTime,hasAttachments,toRecipients`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const listJson = (await listRes.json()) as {
    value?: Array<{
      id: string;
      subject?: string;
      hasAttachments?: boolean;
      toRecipients?: Array<{ emailAddress?: { address?: string } }>;
    }>;
    error?: { message?: string };
  };
  if (!listRes.ok) throw new Error(listJson.error?.message || `list ${listRes.status}`);

  const candidate = (listJson.value ?? []).find(
    (m) =>
      m.hasAttachments &&
      /^UNITED ['‘]26 check-in packet$/i.test(String(m.subject ?? "")) &&
      !/\[TEST\]/i.test(String(m.subject ?? "")),
  );
  if (!candidate) throw new Error("Source UNITED ‘26 check-in packet not found in Sent Items");

  const msgRes = await fetch(`${base}/messages/${candidate.id}?$select=subject,body`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const msg = (await msgRes.json()) as {
    subject?: string;
    body?: { content?: string };
    error?: { message?: string };
  };
  if (!msgRes.ok) throw new Error(msg.error?.message || `message ${msgRes.status}`);

  const html = msg.body?.content ?? "";
  const introMatch = html.match(
    /Hi [^<]+,<\/p>\s*<div style="margin:0 0 16px">([\s\S]*?)<\/div>\s*<table/i,
  );
  if (!introMatch?.[1]) throw new Error("Could not extract intro HTML from source message");
  const introHtml = introMatch[1].trim();

  const attRes = await fetch(`${base}/messages/${candidate.id}/attachments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const attJson = (await attRes.json()) as {
    value?: Array<{
      "@odata.type"?: string;
      name?: string;
      contentType?: string;
      contentBytes?: string;
      isInline?: boolean;
    }>;
    error?: { message?: string };
  };
  if (!attRes.ok) throw new Error(attJson.error?.message || `attachments ${attRes.status}`);

  const pdf = (attJson.value ?? []).find(
    (a) =>
      a["@odata.type"] === "#microsoft.graph.fileAttachment" &&
      !a.isInline &&
      a.contentBytes &&
      /\.pdf$/i.test(a.name || ""),
  );
  if (!pdf?.contentBytes) throw new Error("PDF attachment not found on source message");

  const attachment: CheckInPacketAttachment = {
    fileName: pdf.name || "UNITED_26_Hebron_Youth_Retreat.pdf",
    contentType: pdf.contentType || "application/pdf",
    contentBytesBase64: pdf.contentBytes,
  };

  return {
    subject: candidate.subject || "UNITED ‘26 check-in packet",
    introHtml,
    attachment,
    sourceTo: candidate.toRecipients?.[0]?.emailAddress?.address ?? "(unknown)",
  };
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const confirm = process.env.CONFIRM_SEND?.trim().toLowerCase() === "yes";
  if (!dryRun && !confirm) {
    throw new Error("Refusing to send without CONFIRM_SEND=yes (or set DRY_RUN=1)");
  }

  process.env.CANONICAL_PUBLIC_URL =
    process.env.CANONICAL_PUBLIC_URL?.trim() || "https://events.ipchouston.com";

  const mailbox = process.env.MICROSOFT_GRAPH_MAILBOX?.trim();
  if (!mailbox) throw new Error("MICROSOFT_GRAPH_MAILBOX missing");
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL missing");

  try {
    const token = await getToken();
    const template = await loadTemplateFromSentItems(token, mailbox);
    console.log("template", {
      subject: template.subject,
      sourceTo: template.sourceTo,
      introChars: template.introHtml.length,
      pdfName: template.attachment.fileName,
      pdfBytesApprox: Math.round((template.attachment.contentBytesBase64.length * 3) / 4),
    });

    const season = await prisma.vbsSeason.findFirst({
      where: { name: { contains: "United", mode: "insensitive" } },
      select: { id: true, name: true, publicRegistrationSlug: true, year: true },
    });
    if (!season) throw new Error("UNITED season not found");
    console.log("season", season.name, season.id);

    const { recipients, stats } = await recipientsForCheckInPacketAudience(season.id, "all_active");
    const remaining = recipients.filter((r) => !ALREADY_SENT.has(r.email.trim().toLowerCase()));

    console.log("audienceStats", stats);
    console.log("alreadySentExcluded", ALREADY_SENT.size);
    console.log("remainingFamilies", remaining.length);
    console.log(
      "remainingSample",
      remaining.slice(0, 8).map((r) => ({
        name: r.guardianName,
        email: r.email,
        kids: r.children.length,
      })),
    );

    if (remaining.length === 0) {
      console.log("nothingToSend");
      return;
    }

    if (dryRun) {
      console.log("dryRunComplete", { wouldSend: remaining.length });
      return;
    }

    const emailCtx = await loadRegistrationEmailContext(season.id);
    const seasonName = season.name?.trim() || emailCtx?.eventName?.trim() || "VBS";
    const portal = { publicRegistrationSlug: season.publicRegistrationSlug };
    const contactFooter = emailCtx ? registrationContactFooterInput(emailCtx) : null;

    let sent = 0;
    let failed = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (const recipient of remaining) {
      const result = await sendCheckInPacketEmail({
        recipient,
        subject: template.subject,
        introHtml: template.introHtml,
        attachment: template.attachment,
        portal,
        fromName: seasonName,
        eventName: seasonName,
        teamPhrase: emailCtx?.teamPhrase ?? null,
        contactFooter,
      });
      if (result.ok) {
        sent += 1;
        console.log("sent", sent, recipient.email, recipient.guardianName);
      } else {
        failed += 1;
        failures.push({ email: recipient.email, error: result.error });
        console.error("failed", recipient.email, result.error);
      }
      // Light pacing for Graph
      await new Promise((r) => setTimeout(r, 400));
    }

    console.log("done", { sent, failed, remaining: remaining.length });
    if (failures.length) console.log("failures", JSON.stringify(failures, null, 2));
    if (sent === 0) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
