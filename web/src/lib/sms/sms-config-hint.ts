import { isSentDmSmsConfigured } from "@/lib/sms/sent-dm";
import { isTwilioSmsConfigured } from "@/lib/sms/twilio";

/**
 * Short notice for staff UI when SMS env is incomplete (no secrets exposed).
 */
export function smsGatewaySetupHint(): string | null {
  if (isSentDmSmsConfigured() || isTwilioSmsConfigured()) return null;

  const hasSentKey = Boolean(process.env.SENT_DM_API_KEY?.trim());
  const hasSentTemplate = Boolean(process.env.SENT_DM_SMS_TEMPLATE_ID?.trim());

  if (hasSentKey && !hasSentTemplate) {
    return "Sent.dm: add SENT_DM_SMS_TEMPLATE_ID to .env.local (approved SMS template UUID from the Sent dashboard). Restart the dev server after saving.";
  }
  if (!hasSentKey && hasSentTemplate) {
    return "Sent.dm: SENT_DM_API_KEY is missing while a template ID is set. Add your API key from Sent → API keys.";
  }

  return null;
}
