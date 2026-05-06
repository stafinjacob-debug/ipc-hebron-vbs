/**
 * Sent.dm (https://sent.dm) SMS via REST API v3.
 * Template parameters must match your Sent template (e.g. {{message}}, {{body}}, or {{var_1}} → set SENT_DM_TEMPLATE_PARAMETER).
 */

type SentSendOk = { ok: true; messageId: string };
type SentSendErr = { ok: false; error: string };

function getSentDmConfig() {
  const apiBase = (process.env.SENT_DM_API_BASE?.trim() || "https://api.sent.dm").replace(/\/+$/, "");
  const apiKey = process.env.SENT_DM_API_KEY?.trim() ?? "";
  const templateId = process.env.SENT_DM_SMS_TEMPLATE_ID?.trim() ?? "";
  const templateName = process.env.SENT_DM_SMS_TEMPLATE_NAME?.trim() ?? "";
  /** Must match the variable name in your Sent template (e.g. body is `{{message}}` → `message`). */
  const templateParameter =
    (process.env.SENT_DM_TEMPLATE_PARAMETER?.trim() || "message").replace(/[^a-zA-Z0-9_]/g, "") || "message";
  /** Optional JSON object merged into template.parameters before the main body key (for multi-variable templates). */
  const templateParametersJson = process.env.SENT_DM_TEMPLATE_PARAMETERS_JSON?.trim() ?? "";
  /** When true, do not send template.parameters (use for Sent templates with no merge fields). */
  const omitTemplateParameters =
    process.env.SENT_DM_OMIT_TEMPLATE_PARAMETERS === "true" || process.env.SENT_DM_OMIT_TEMPLATE_PARAMETERS === "1";
  const sandbox = process.env.SENT_DM_SANDBOX === "true" || process.env.SENT_DM_SANDBOX === "1";
  /** Organization API keys may need to scope sends to a child profile (Sent dashboard → Profiles). */
  const profileId = process.env.SENT_DM_PROFILE_ID?.trim() ?? "";
  return {
    apiBase,
    apiKey,
    profileId,
    templateId,
    templateName,
    templateParameter,
    templateParametersJson,
    omitTemplateParameters,
    sandbox,
  };
}

/** Collapse whitespace/newlines so pasted custom SMS matches typical Sent SMS variable rules. */
function sanitizeSentTemplateStringValue(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\s+/g, " ").trim();
}

type SentTemplateMeta = {
  name?: string;
  category?: string;
  variables?: string[];
};

const templateMetaCache = new Map<string, { meta: SentTemplateMeta; expiresAt: number }>();
const TEMPLATE_META_TTL_MS = 10 * 60 * 1000;

async function fetchSentTemplateMeta(params: {
  apiBase: string;
  apiKey: string;
  profileId: string;
  templateId: string;
}): Promise<SentTemplateMeta | null> {
  const hit = templateMetaCache.get(params.templateId);
  if (hit && hit.expiresAt > Date.now()) return hit.meta;

  const headers: Record<string, string> = { "x-api-key": params.apiKey };
  if (params.profileId) headers["x-profile-id"] = params.profileId;
  try {
    const res = await fetch(`${params.apiBase}/v3/templates/${encodeURIComponent(params.templateId)}`, {
      headers,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: { name?: string; category?: string; variables?: string[] };
    };
    if (json.success !== true || !json.data) return null;
    const meta: SentTemplateMeta = {
      name: json.data.name,
      category: json.data.category,
      variables: json.data.variables ?? undefined,
    };
    templateMetaCache.set(params.templateId, { meta, expiresAt: Date.now() + TEMPLATE_META_TTL_MS });
    return meta;
  } catch {
    return null;
  }
}

/** AUTHENTICATION templates (e.g. sent_Verify_Code_2) expect a short numeric code in var_1, not prose/URLs. */
function isPlausibleAuthenticationVar1(value: string): boolean {
  const t = value.trim();
  if (t.length > 24) return false;
  if (/https?:\/\//i.test(t)) return false;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 12) return false;
  const nonAllowed = t.replace(/[\d\s\-_.]/g, "");
  return nonAllowed.length === 0;
}

function formatSentErrorDetails(details: unknown): string {
  if (details == null) return "";
  if (typeof details === "string") return details.trim();
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function buildTemplateParameters(params: {
  bodyText: string;
  templateParameter: string;
  templateParametersJson: string;
  omitTemplateParameters: boolean;
}): { ok: true; parameters: Record<string, string> } | { ok: false; error: string } {
  if (params.omitTemplateParameters) {
    return { ok: true, parameters: {} };
  }
  const out: Record<string, string> = {};
  if (params.templateParametersJson) {
    try {
      const parsed = JSON.parse(params.templateParametersJson) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "SENT_DM_TEMPLATE_PARAMETERS_JSON must be a JSON object." };
      }
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          out[k] = String(v);
        }
      }
    } catch {
      return { ok: false, error: "SENT_DM_TEMPLATE_PARAMETERS_JSON is not valid JSON." };
    }
  }
  out[params.templateParameter] = sanitizeSentTemplateStringValue(params.bodyText);
  for (const k of Object.keys(out)) {
    if (k !== params.templateParameter) out[k] = sanitizeSentTemplateStringValue(out[k]);
  }
  return { ok: true, parameters: out };
}

export function isSentDmSmsConfigured(): boolean {
  const c = getSentDmConfig();
  return Boolean(c.apiKey && c.templateId);
}

export async function sendSmsViaSentDm(params: {
  toPhone: string;
  body: string;
  /** Optional; Sent recommends Idempotency-Key for safe retries (max ~128 chars). */
  idempotencyKey?: string | null;
}): Promise<SentSendOk | SentSendErr> {
  const {
    apiBase,
    apiKey,
    profileId,
    templateId,
    templateName,
    templateParameter,
    templateParametersJson,
    omitTemplateParameters,
    sandbox,
  } = getSentDmConfig();
  if (!apiKey || !templateId) {
    return { ok: false, error: "Sent.dm SMS is not fully configured." };
  }

  const text = sanitizeSentTemplateStringValue(params.body.slice(0, 1600));
  const built = buildTemplateParameters({
    bodyText: text,
    templateParameter,
    templateParametersJson,
    omitTemplateParameters,
  });
  if (!built.ok) return built;

  const meta = await fetchSentTemplateMeta({ apiBase, apiKey, profileId, templateId });
  if (meta?.category === "AUTHENTICATION" && !omitTemplateParameters) {
    const main = built.parameters[templateParameter] ?? "";
    if (!isPlausibleAuthenticationVar1(main)) {
      return {
        ok: false,
        error:
          `Sent template "${meta.name ?? templateId}" is AUTHENTICATION (e.g. verify-code). ` +
          `${templateParameter} must be a short numeric code only — not registration text or URLs. ` +
          `Use a UTILITY SMS template for confirmation/check-in messages, or run: npm run sms:sent-template`,
      };
    }
  }

  const templatePayload: Record<string, unknown> = { id: templateId };
  if (templateName) templatePayload.name = templateName;
  if (Object.keys(built.parameters).length > 0) {
    templatePayload.parameters = built.parameters;
  }

  // Sent docs: omitting `channel` uses automatic selection (may choose WhatsApp). Listing multiple
  // channels sends one message per channel. For VBS registration SMS we always force SMS only:
  // https://docs.sent.dm/start/guides/sending-messages — "Force Specific Channel" → SMS only.
  const payload: Record<string, unknown> = {
    to: [params.toPhone],
    channel: ["sms"],
    template: templatePayload,
  };
  if (sandbox) payload.sandbox = true;

  const idem = (params.idempotencyKey ?? "").trim().slice(0, 120);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
  if (idem) headers["Idempotency-Key"] = idem;
  if (profileId) headers["x-profile-id"] = profileId;

  try {
    const res = await fetch(`${apiBase}/v3/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    let json: {
      success?: boolean;
      data?: { recipients?: Array<{ message_id?: string }> };
      error?: { message?: string; code?: string; details?: unknown };
      meta?: { request_id?: string };
    };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      return { ok: false, error: `Sent.dm: invalid response body (HTTP ${res.status}).` };
    }

    const requestId = typeof json.meta?.request_id === "string" ? json.meta.request_id : null;
    const withRequestId = (msg: string) => (requestId ? `${msg} (Sent request_id: ${requestId})` : msg);

    const httpOk = res.status >= 200 && res.status < 300;
    if (!httpOk || json.success !== true) {
      const code = typeof json.error?.code === "string" ? json.error.code : null;
      const detailStr = formatSentErrorDetails(json.error?.details);
      const base =
        json.error?.message ||
        code ||
        `Sent.dm HTTP ${res.status}`;
      const msg =
        detailStr && !base.includes(detailStr)
          ? `${base}${code ? ` [${code}]` : ""} — ${detailStr}`
          : `${base}${code && !base.includes(code) ? ` [${code}]` : ""}`;
      return { ok: false, error: withRequestId(msg) };
    }

    const rec = json.data?.recipients?.[0] as { message_id?: string; messageId?: string } | undefined;
    const messageId = rec?.message_id ?? rec?.messageId;
    if (!messageId) {
      return { ok: false, error: withRequestId("Sent.dm: missing message_id in response.") };
    }
    return { ok: true, messageId };
  } catch (e: unknown) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Sent.dm request failed." };
  }
}
