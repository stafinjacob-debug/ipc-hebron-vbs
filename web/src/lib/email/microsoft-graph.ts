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

export type SendGraphMailInput = {
  toAddress: string;
  toName?: string | null;
  subject: string;
  htmlBody: string;
  attachments?: GraphMailAttachment[];
};

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
        toRecipients: [
          {
            emailAddress: {
              address: input.toAddress,
              name: input.toName?.trim() || input.toAddress,
            },
          },
        ],
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
