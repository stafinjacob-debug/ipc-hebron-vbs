/**
 * Sent.dm (https://sent.dm) SMS via REST API v3.
 * Requires an approved SMS template with a single text placeholder (default param key: `message`).
 */

type SentSendOk = { ok: true; messageId: string };
type SentSendErr = { ok: false; error: string };

function getSentDmConfig() {
  const apiKey = process.env.SENT_DM_API_KEY?.trim() ?? "";
  const templateId = process.env.SENT_DM_SMS_TEMPLATE_ID?.trim() ?? "";
  /** Must match the variable name in your Sent template (e.g. body is `{{message}}` → `message`). */
  const templateParameter =
    (process.env.SENT_DM_TEMPLATE_PARAMETER?.trim() || "message").replace(/[^a-zA-Z0-9_]/g, "") || "message";
  const sandbox = process.env.SENT_DM_SANDBOX === "true" || process.env.SENT_DM_SANDBOX === "1";
  return { apiKey, templateId, templateParameter, sandbox };
}

export function isSentDmSmsConfigured(): boolean {
  const c = getSentDmConfig();
  return Boolean(c.apiKey && c.templateId);
}

export async function sendSmsViaSentDm(params: {
  toPhone: string;
  body: string;
}): Promise<SentSendOk | SentSendErr> {
  const { apiKey, templateId, templateParameter, sandbox } = getSentDmConfig();
  if (!apiKey || !templateId) {
    return { ok: false, error: "Sent.dm SMS is not fully configured." };
  }

  const text = params.body.slice(0, 1600);
  const payload: Record<string, unknown> = {
    to: [params.toPhone],
    channel: ["sms"],
    template: {
      id: templateId,
      parameters: {
        [templateParameter]: text,
      },
    },
  };
  if (sandbox) payload.sandbox = true;

  try {
    const res = await fetch("https://api.sent.dm/v3/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    let json: {
      success?: boolean;
      data?: { recipients?: Array<{ message_id?: string }> };
      error?: { message?: string; code?: string; details?: unknown };
    };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      return { ok: false, error: `Sent.dm: invalid response body (HTTP ${res.status}).` };
    }

    if (!res.ok || json.success !== true) {
      const msg =
        json.error?.message ||
        (typeof json.error?.code === "string" ? json.error.code : null) ||
        `Sent.dm HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    const messageId = json.data?.recipients?.[0]?.message_id;
    if (!messageId) {
      return { ok: false, error: "Sent.dm: missing message_id in response." };
    }
    return { ok: true, messageId };
  } catch (e: unknown) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Sent.dm request failed." };
  }
}
