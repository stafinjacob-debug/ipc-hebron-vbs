import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { registrationTicketUrl } from "@/lib/registration-identity";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { isSentDmSmsConfigured, sendSmsViaSentDm } from "@/lib/sms/sent-dm";
import { isTwilioSmsConfigured, normalizePhoneForSms, sendSmsViaTwilio } from "@/lib/sms/twilio";

/** Legacy skip / ineligible outcomes (no provider call). */
export type SmsSendSkip = "skipped_no_phone" | "skipped_no_sms" | "skipped_ineligible";

export type SmsSendOutcome =
  | { status: "sent"; provider: "sent-dm" | "twilio"; sentViaTwilioFallback: boolean }
  | { status: SmsSendSkip }
  | { status: "failed"; detail: string };

function isSmsGatewayConfigured(): boolean {
  return isSentDmSmsConfigured() || isTwilioSmsConfigured();
}

function sentDmTwilioFallbackDisabled(): boolean {
  return process.env.SENT_DM_DISABLE_TWILIO_FALLBACK === "true" || process.env.SENT_DM_DISABLE_TWILIO_FALLBACK === "1";
}

function truncateDetail(s: string, max = 480): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Prefer Sent.dm when configured; on failure optionally fall back to Twilio when both are set. */
async function sendSmsViaConfiguredProvider(params: {
  toPhone: string;
  body: string;
  idempotencyKey?: string | null;
}): Promise<
  | { ok: true; provider: "sent-dm" | "twilio"; sentViaTwilioFallback: boolean }
  | { ok: false; detail: string }
> {
  const sentOk = isSentDmSmsConfigured();
  const twilioOk = isTwilioSmsConfigured();

  if (sentOk) {
    const r = await sendSmsViaSentDm({
      toPhone: params.toPhone,
      body: params.body,
      idempotencyKey: params.idempotencyKey,
    });
    if (r.ok) {
      return { ok: true, provider: "sent-dm", sentViaTwilioFallback: false };
    }
    if (twilioOk && !sentDmTwilioFallbackDisabled()) {
      const t = await sendSmsViaTwilio({ toPhone: params.toPhone, body: params.body });
      if (t.ok) {
        return {
          ok: true,
          provider: "twilio",
          sentViaTwilioFallback: true,
        };
      }
      return {
        ok: false,
        detail: truncateDetail(`Sent.dm: ${r.error}. Twilio fallback: ${t.error}`),
      };
    }
    return { ok: false, detail: truncateDetail(r.error) };
  }

  if (twilioOk) {
    const t = await sendSmsViaTwilio({ toPhone: params.toPhone, body: params.body });
    return t.ok
      ? { ok: true, provider: "twilio", sentViaTwilioFallback: false }
      : { ok: false, detail: truncateDetail(t.error) };
  }

  return { ok: false, detail: "No SMS provider configured." };
}

function smsBrandName(): string {
  return process.env.REGISTRATION_SMS_BRAND?.trim() || process.env.REGISTRATION_EMAIL_BRAND?.trim() || "IPC Hebron VBS";
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export async function sendRegistrationConfirmationSms(registrationId: string): Promise<SmsSendOutcome> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: { include: { guardian: true } },
      season: true,
    },
  });
  if (!reg) return { status: "skipped_no_phone" };
  if (reg.status !== "CONFIRMED" || !reg.registrationNumber || !reg.checkInToken) return { status: "skipped_ineligible" };

  const to = normalizePhoneForSms(reg.child.guardian.phone);
  if (!to) return { status: "skipped_no_phone" };
  if (!isSmsGatewayConfigured()) return { status: "skipped_no_sms" };

  const firstName = reg.child.guardian.firstName?.trim() || "Parent";
  const childName = `${reg.child.firstName} ${reg.child.lastName}`.trim();
  const ticketUrl = registrationTicketUrl(reg.checkInToken, getPublicAppBaseUrl());
  const body = collapseWs(
    `${smsBrandName()}: Hi ${firstName}, ${childName} is confirmed for ${reg.season.name}. ` +
      `Reg # ${reg.registrationNumber}. Ticket: ${ticketUrl}`,
  );

  const idempotencyKey = `vbs-reg-${registrationId}-confirm-sms`;
  const sent = await sendSmsViaConfiguredProvider({ toPhone: to, body, idempotencyKey });
  if (sent.ok) return { status: "sent", provider: sent.provider, sentViaTwilioFallback: sent.sentViaTwilioFallback };
  return { status: "failed", detail: sent.detail };
}

export async function sendCustomRegistrationSms(registrationId: string, message: string): Promise<SmsSendOutcome> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: { include: { guardian: true } },
    },
  });
  if (!reg) return { status: "skipped_no_phone" };

  const to = normalizePhoneForSms(reg.child.guardian.phone);
  if (!to) return { status: "skipped_no_phone" };
  if (!isSmsGatewayConfigured()) return { status: "skipped_no_sms" };

  const text = collapseWs(message);
  if (!text) return { status: "skipped_ineligible" };

  const hash = createHash("sha256").update(text).digest("hex").slice(0, 24);
  const idempotencyKey = `vbs-reg-${registrationId}-custom-${hash}`;

  const sent = await sendSmsViaConfiguredProvider({
    toPhone: to,
    body: text.slice(0, 1200),
    idempotencyKey,
  });
  if (sent.ok) return { status: "sent", provider: sent.provider, sentViaTwilioFallback: sent.sentViaTwilioFallback };
  return { status: "failed", detail: sent.detail };
}
