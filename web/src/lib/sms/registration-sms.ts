import { prisma } from "@/lib/prisma";
import { registrationTicketUrl } from "@/lib/registration-identity";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { isTwilioSmsConfigured, normalizePhoneForSms, sendSmsViaTwilio } from "@/lib/sms/twilio";

export type SmsSendResult =
  | "sent"
  | "skipped_no_phone"
  | "skipped_no_twilio"
  | "skipped_ineligible"
  | "failed";

function smsBrandName(): string {
  return process.env.REGISTRATION_SMS_BRAND?.trim() || process.env.REGISTRATION_EMAIL_BRAND?.trim() || "IPC Hebron VBS";
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export async function sendRegistrationConfirmationSms(registrationId: string): Promise<SmsSendResult> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: { include: { guardian: true } },
      season: true,
    },
  });
  if (!reg) return "skipped_no_phone";
  if (reg.status !== "CONFIRMED" || !reg.registrationNumber || !reg.checkInToken) return "skipped_ineligible";

  const to = normalizePhoneForSms(reg.child.guardian.phone);
  if (!to) return "skipped_no_phone";
  if (!isTwilioSmsConfigured()) return "skipped_no_twilio";

  const firstName = reg.child.guardian.firstName?.trim() || "Parent";
  const childName = `${reg.child.firstName} ${reg.child.lastName}`.trim();
  const ticketUrl = registrationTicketUrl(reg.checkInToken, getPublicAppBaseUrl());
  const body = collapseWs(
    `${smsBrandName()}: Hi ${firstName}, ${childName} is confirmed for ${reg.season.name}. ` +
      `Reg # ${reg.registrationNumber}. Ticket: ${ticketUrl}`,
  );

  const sent = await sendSmsViaTwilio({ toPhone: to, body });
  return sent.ok ? "sent" : "failed";
}

export async function sendCustomRegistrationSms(
  registrationId: string,
  message: string,
): Promise<SmsSendResult> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: { include: { guardian: true } },
      season: true,
    },
  });
  if (!reg) return "skipped_no_phone";

  const to = normalizePhoneForSms(reg.child.guardian.phone);
  if (!to) return "skipped_no_phone";
  if (!isTwilioSmsConfigured()) return "skipped_no_twilio";

  const text = collapseWs(message);
  if (!text) return "skipped_ineligible";

  const sent = await sendSmsViaTwilio({ toPhone: to, body: text.slice(0, 1200) });
  return sent.ok ? "sent" : "failed";
}
