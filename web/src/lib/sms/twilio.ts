import Twilio from "twilio";

type TwilioSendOk = { ok: true; sid: string };
type TwilioSendErr = { ok: false; error: string };

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const fromPhone = process.env.TWILIO_FROM_PHONE?.trim() ?? "";
  return { accountSid, authToken, fromPhone };
}

export function isTwilioSmsConfigured(): boolean {
  const cfg = getTwilioConfig();
  return Boolean(cfg.accountSid && cfg.authToken && cfg.fromPhone);
}

export function normalizePhoneForSms(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;

  // Keep leading "+" if present; remove separators and punctuation.
  const compact = v.replace(/[^\d+]/g, "");
  if (!compact) return null;

  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digitsOnly = compact.replace(/\D/g, "");
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) return `+${digitsOnly}`;
  return null;
}

export async function sendSmsViaTwilio(params: {
  toPhone: string;
  body: string;
}): Promise<TwilioSendOk | TwilioSendErr> {
  const cfg = getTwilioConfig();
  if (!cfg.accountSid || !cfg.authToken || !cfg.fromPhone) {
    return { ok: false, error: "Twilio SMS is not fully configured." };
  }
  const client = Twilio(cfg.accountSid, cfg.authToken);
  try {
    const resp = await client.messages.create({
      from: cfg.fromPhone,
      to: params.toPhone,
      body: params.body,
    });
    return { ok: true, sid: resp.sid };
  } catch (e: unknown) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Twilio send failed." };
  }
}
