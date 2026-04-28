type TokenCache = { accessToken: string; expiresAtMs: number };

let tokenCache: TokenCache | null = null;

export type GraphMailboxMessage = {
  id: string;
  conversationId: string | null;
  internetMessageId: string | null;
  subject: string;
  fromName: string | null;
  fromAddress: string;
  receivedAt: Date;
  isRead: boolean;
  bodyPreview: string | null;
  bodyContentType: string | null;
  bodyContent: string | null;
};

function mailboxAddress(): string | null {
  return process.env.MICROSOFT_GRAPH_MAILBOX?.trim() || null;
}

export function isMicrosoftGraphMailboxConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_GRAPH_TENANT_ID?.trim() &&
      process.env.MICROSOFT_GRAPH_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_GRAPH_CLIENT_SECRET?.trim() &&
      mailboxAddress(),
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

function normalizeBodyToText(contentType: string | null | undefined, content: string | null | undefined): string | null {
  if (!content) return null;
  if ((contentType ?? "").toLowerCase() === "text") return content.trim() || null;
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

export async function listInboxMessages(
  top = 50,
): Promise<{ ok: true; messages: GraphMailboxMessage[] } | { ok: false; error: string }> {
  const mailbox = mailboxAddress();
  if (!mailbox) return { ok: false, error: "MICROSOFT_GRAPH_MAILBOX is not configured." };

  const tokenResult = await getAppAccessToken();
  if (!tokenResult.ok) return tokenResult;

  const params = new URLSearchParams({
    $top: String(Math.min(Math.max(top, 1), 200)),
    $orderby: "receivedDateTime desc",
    $select: [
      "id",
      "conversationId",
      "internetMessageId",
      "subject",
      "from",
      "receivedDateTime",
      "isRead",
      "bodyPreview",
      "body",
    ].join(","),
  });
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/Inbox/messages?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.body-content-type="text"',
    },
  });

  const json = (await res.json().catch(() => ({}))) as {
    value?: Array<{
      id: string;
      conversationId?: string | null;
      internetMessageId?: string | null;
      subject?: string | null;
      from?: { emailAddress?: { name?: string | null; address?: string | null } };
      receivedDateTime?: string;
      isRead?: boolean;
      bodyPreview?: string | null;
      body?: { contentType?: string | null; content?: string | null };
    }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      error: `Graph inbox fetch failed (${res.status}): ${json.error?.message ?? res.statusText}`,
    };
  }

  const messages: GraphMailboxMessage[] = (json.value ?? [])
    .filter((item) => Boolean(item.id && item.from?.emailAddress?.address && item.receivedDateTime))
    .map((item) => ({
      id: item.id,
      conversationId: item.conversationId ?? null,
      internetMessageId: item.internetMessageId ?? null,
      subject: item.subject?.trim() || "(No subject)",
      fromName: item.from?.emailAddress?.name?.trim() || null,
      fromAddress: item.from!.emailAddress!.address!.trim().toLowerCase(),
      receivedAt: new Date(item.receivedDateTime!),
      isRead: Boolean(item.isRead),
      bodyPreview: item.bodyPreview?.trim() || null,
      bodyContentType: item.body?.contentType?.trim() || null,
      bodyContent: normalizeBodyToText(item.body?.contentType, item.body?.content),
    }));

  return { ok: true, messages };
}

export async function replyToMessageViaGraph(params: {
  graphMessageId: string;
  replyText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const mailbox = mailboxAddress();
  if (!mailbox) return { ok: false, error: "MICROSOFT_GRAPH_MAILBOX is not configured." };

  const tokenResult = await getAppAccessToken();
  if (!tokenResult.ok) return tokenResult;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(params.graphMessageId)}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: params.replyText.trim(),
      }),
    },
  );

  if (res.ok || res.status === 202) return { ok: true };

  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return {
    ok: false,
    error: `Graph reply failed (${res.status}): ${json.error?.message ?? res.statusText}`,
  };
}
