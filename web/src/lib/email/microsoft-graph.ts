/**
 * Microsoft Graph — app-only mail (client credentials).
 *
 * Azure AD app registration:
 * - Certificates & secrets: create a client secret
 * - API permissions → Microsoft Graph → Application → Mail.Send → Grant admin consent
 * - The mailbox in MICROSOFT_GRAPH_MAILBOX must exist in that tenant (user or shared mailbox with send-as).
 */

type TokenCache = { accessToken: string; expiresAtMs: number };

let tokenCache: TokenCache | null = null;

export function isMicrosoftGraphEmailConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_GRAPH_TENANT_ID?.trim() &&
      process.env.MICROSOFT_GRAPH_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_GRAPH_CLIENT_SECRET?.trim() &&
      process.env.MICROSOFT_GRAPH_MAILBOX?.trim(),
  );
}

async function getAppAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_GRAPH_CLIENT_SECRET?.trim();

  if (!tenantId || !clientId || !clientSecret) {
    return { ok: false, error: "Microsoft Graph is not fully configured (missing tenant, client id, or secret)." };
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return { ok: true, token: tokenCache.accessToken };
  }

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

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    const hint = json.error_description ?? json.error ?? res.statusText;
    return { ok: false, error: `Token request failed (${res.status}): ${hint}` };
  }

  const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };

  return { ok: true, token: json.access_token };
}

export type GraphMailAttachment = {
  name: string;
  contentType: string;
  /** Raw file bytes as base64 (not a data: URL). */
  contentBytesBase64: string;
  isInline?: boolean;
  /** For HTML `cid:contentId` when isInline is true. */
  contentId?: string;
};

/** Graph `/sendMail` JSON body is limited to ~4 MB. Leave room for the HTML body. */
export const GRAPH_SIMPLE_SEND_ATTACHMENT_BUDGET = 2_400_000;

export function graphAttachmentRawBytes(attachment: GraphMailAttachment): number {
  return Math.ceil((attachment.contentBytesBase64.length * 3) / 4);
}

export function packGraphAttachmentBatches(
  attachments: GraphMailAttachment[],
  budget = GRAPH_SIMPLE_SEND_ATTACHMENT_BUDGET,
): GraphMailAttachment[][] {
  const batches: GraphMailAttachment[][] = [];
  let current: GraphMailAttachment[] = [];
  let used = 0;
  for (const attachment of attachments) {
    const size = graphAttachmentRawBytes(attachment);
    if (current.length > 0 && used + size > budget) {
      batches.push(current);
      current = [];
      used = 0;
    }
    current.push(attachment);
    used += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

export type SendGraphMailInput = {
  toAddress: string;
  toName?: string | null;
  /** Extra To: recipients (address only). Primary is still `toAddress` / `toName`. */
  additionalToAddresses?: string[];
  subject: string;
  htmlBody: string;
  attachments?: GraphMailAttachment[];
  /** Inbox sender display name (Graph `from.emailAddress.name`). Falls back to EMAIL_FROM_DISPLAY_NAME. */
  fromName?: string | null;
};

function resolveGraphFromDisplayName(explicit?: string | null): string | undefined {
  const name = explicit?.trim() || process.env.EMAIL_FROM_DISPLAY_NAME?.trim();
  return name || undefined;
}

export async function sendMailViaMicrosoftGraph(
  input: SendGraphMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isMicrosoftGraphEmailConfigured()) {
    return { ok: false, error: "Microsoft Graph mail environment variables are not set." };
  }

  const mailbox = process.env.MICROSOFT_GRAPH_MAILBOX!.trim();
  const tokenResult = await getAppAccessToken();
  if (!tokenResult.ok) return tokenResult;

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`;

  const attachments =
    input.attachments?.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentType: a.contentType,
      contentBytes: a.contentBytesBase64,
      isInline: a.isInline ?? false,
      ...(a.contentId ? { contentId: a.contentId } : {}),
    })) ?? [];

  const primaryTrimmed = input.toAddress.trim();
  const primaryLower = primaryTrimmed.toLowerCase();
  const seen = new Set<string>([primaryLower]);
  const toRecipients: Array<{ emailAddress: { address: string; name: string } }> = [
    {
      emailAddress: {
        address: primaryTrimmed,
        name: input.toName?.trim() || primaryTrimmed,
      },
    },
  ];
  for (const raw of input.additionalToAddresses ?? []) {
    const addr = raw.trim();
    if (!addr) continue;
    const lower = addr.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    toRecipients.push({
      emailAddress: { address: addr, name: addr },
    });
  }

  const fromDisplayName = resolveGraphFromDisplayName(input.fromName);
  const fromRecipient = fromDisplayName
    ? {
        emailAddress: {
          address: mailbox,
          name: fromDisplayName,
        },
      }
    : undefined;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.htmlBody,
        },
        ...(fromRecipient ? { from: fromRecipient, sender: fromRecipient } : {}),
        toRecipients,
        ...(attachments.length ? { attachments } : {}),
      },
      saveToSentItems: true,
    }),
  });

  if (res.ok || res.status === 202) {
    return { ok: true };
  }

  let detail = res.statusText;
  try {
    const errJson = (await res.json()) as { error?: { message?: string; code?: string } };
    if (errJson.error?.message) detail = errJson.error.message;
  } catch {
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
  }

  return {
    ok: false,
    error: `Graph sendMail failed (${res.status}): ${detail}`,
  };
}

async function readGraphError(res: Response, fallback: string): Promise<string> {
  try {
    const errJson = (await res.json()) as { error?: { message?: string } };
    if (errJson.error?.message) return errJson.error.message;
  } catch {
    try {
      const text = await res.text();
      if (text.trim()) return text;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

async function uploadOutlookAttachmentSession(
  uploadUrl: string,
  bytes: Buffer,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const chunkSize = 4 * 1024 * 1024;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, bytes.length) - 1;
    const chunk = bytes.subarray(start, end + 1);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
      },
      body: chunk,
    });
    if (!res.ok && res.status !== 200 && res.status !== 201 && res.status !== 202) {
      return { ok: false, error: await readGraphError(res, res.statusText) };
    }
  }
  return { ok: true };
}

async function sendMailViaDraftAndUpload(
  input: SendGraphMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mailbox = process.env.MICROSOFT_GRAPH_MAILBOX!.trim();
  const tokenResult = await getAppAccessToken();
  if (!tokenResult.ok) return tokenResult;

  const headers = {
    Authorization: `Bearer ${tokenResult.token}`,
    "Content-Type": "application/json",
  };
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}`;

  const primaryTrimmed = input.toAddress.trim();
  const seen = new Set<string>([primaryTrimmed.toLowerCase()]);
  const toRecipients: Array<{ emailAddress: { address: string; name: string } }> = [
    { emailAddress: { address: primaryTrimmed, name: input.toName?.trim() || primaryTrimmed } },
  ];
  for (const raw of input.additionalToAddresses ?? []) {
    const addr = raw.trim();
    if (!addr || seen.has(addr.toLowerCase())) continue;
    seen.add(addr.toLowerCase());
    toRecipients.push({ emailAddress: { address: addr, name: addr } });
  }

  const fromDisplayName = resolveGraphFromDisplayName(input.fromName);
  const draftRes = await fetch(`${base}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "HTML", content: input.htmlBody },
      toRecipients,
      ...(fromDisplayName
        ? { from: { emailAddress: { address: mailbox, name: fromDisplayName } } }
        : {}),
    }),
  });
  if (!draftRes.ok) {
    return { ok: false, error: `Graph draft create failed (${draftRes.status}): ${await readGraphError(draftRes, draftRes.statusText)}` };
  }
  const draft = (await draftRes.json()) as { id?: string };
  if (!draft.id) return { ok: false, error: "Graph draft create did not return a message id." };

  for (const attachment of input.attachments ?? []) {
    const bytes = Buffer.from(attachment.contentBytesBase64, "base64");
    if (bytes.length <= GRAPH_SIMPLE_SEND_ATTACHMENT_BUDGET) {
      const add = await fetch(`${base}/messages/${encodeURIComponent(draft.id)}/attachments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: attachment.name,
          contentType: attachment.contentType,
          contentBytes: attachment.contentBytesBase64,
        }),
      });
      if (!add.ok) {
        return { ok: false, error: `Graph attach failed (${add.status}): ${await readGraphError(add, add.statusText)}` };
      }
      continue;
    }

    const sessionRes = await fetch(
      `${base}/messages/${encodeURIComponent(draft.id)}/attachments/createUploadSession`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          AttachmentItem: {
            attachmentType: "file",
            name: attachment.name,
            size: bytes.length,
            contentType: attachment.contentType,
          },
        }),
      },
    );
    if (!sessionRes.ok) {
      return {
        ok: false,
        error: `Graph upload session failed (${sessionRes.status}): ${await readGraphError(sessionRes, sessionRes.statusText)}`,
      };
    }
    const session = (await sessionRes.json()) as { uploadUrl?: string };
    if (!session.uploadUrl) return { ok: false, error: "Graph upload session did not return an upload URL." };
    const uploaded = await uploadOutlookAttachmentSession(session.uploadUrl, bytes);
    if (!uploaded.ok) return uploaded;
  }

  const sendRes = await fetch(`${base}/messages/${encodeURIComponent(draft.id)}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenResult.token}` },
  });
  if (!sendRes.ok && sendRes.status !== 202) {
    return { ok: false, error: `Graph draft send failed (${sendRes.status}): ${await readGraphError(sendRes, sendRes.statusText)}` };
  }
  return { ok: true };
}

/** Sends one or more Graph messages so supporting documents are not dropped by the 4 MB sendMail limit. */
export async function sendMailViaMicrosoftGraphAllowingLargeAttachments(
  input: SendGraphMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attachments = input.attachments ?? [];
  if (attachments.length === 0) return sendMailViaMicrosoftGraph(input);

  const total = attachments.reduce((sum, a) => sum + graphAttachmentRawBytes(a), 0);
  if (total <= GRAPH_SIMPLE_SEND_ATTACHMENT_BUDGET) {
    return sendMailViaMicrosoftGraph(input);
  }

  const draft = await sendMailViaDraftAndUpload(input);
  if (draft.ok) return draft;
  console.error("[graph mail] draft/upload failed, falling back to batched sendMail", draft.error);

  const batches = packGraphAttachmentBatches(attachments);
  let sent = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    if (batch.some((a) => graphAttachmentRawBytes(a) > GRAPH_SIMPLE_SEND_ATTACHMENT_BUDGET)) {
      continue;
    }
    const result = await sendMailViaMicrosoftGraph({
      ...input,
      subject: i === 0 ? input.subject : `${input.subject} (supporting documents ${i + 1})`,
      htmlBody:
        i === 0
          ? input.htmlBody
          : "<p>Additional supporting documents for this application are attached.</p>",
      attachments: batch,
    });
    if (!result.ok) return result;
    sent += 1;
  }
  if (sent === 0) return draft;
  return { ok: true };
}
