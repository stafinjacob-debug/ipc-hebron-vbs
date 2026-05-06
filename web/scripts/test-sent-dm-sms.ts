/**
 * Smoke-test Sent.dm SMS using the same env as the app (.env.local via npm script).
 *
 * Usage (from web/):
 *   npm run sms:test-sent -- +15551234567
 */
import { isSentDmSmsConfigured, sendSmsViaSentDm } from "../src/lib/sms/sent-dm";
import { normalizePhoneForSms } from "../src/lib/sms/twilio";

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Usage: npm run sms:test-sent -- +15551234567");
    process.exit(1);
  }
  const to = normalizePhoneForSms(raw);
  if (!to) {
    console.error("Invalid phone. Use E.164, e.g. +15551234567");
    process.exit(1);
  }
  if (!isSentDmSmsConfigured()) {
    console.error("Sent.dm is not fully configured. Set SENT_DM_API_KEY and SENT_DM_SMS_TEMPLATE_ID in .env.local.");
    process.exit(1);
  }
  const body =
    process.env.REGISTRATION_SMS_BRAND?.trim() ||
    process.env.REGISTRATION_EMAIL_BRAND?.trim() ||
    "IPC Hebron VBS";
  const r = await sendSmsViaSentDm({
    toPhone: to,
    body: `${body}: Test SMS from local script. If you received this, Sent.dm is working.`,
    idempotencyKey: `vbs-script-test-${Date.now()}`,
  });
  if (r.ok) {
    console.log("OK — Sent.dm message_id:", r.messageId);
    process.exit(0);
  }
  console.error("FAILED:", r.error);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
