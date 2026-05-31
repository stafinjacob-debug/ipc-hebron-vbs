/** Client-safe constants and types for registrant audience selection. No server imports. */

export const COMPOSE_TO_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ComposeRegistrantAudience =
  | "all_active"
  | "confirmed"
  | "pending"
  | "waitlist"
  | "cancelled"
  | "checked_out"
  | "paid"
  | "payment_due"
  | "checkout_pending"
  | "payment_not_required";

export type ComposeRegistrantAudienceOption = {
  value: ComposeRegistrantAudience;
  label: string;
  hint: string;
};

/** Recipient groups staff typically email during VBS season. */
export const COMPOSE_REGISTRANT_AUDIENCE_OPTIONS: ComposeRegistrantAudienceOption[] = [
  {
    value: "all_active",
    label: "All active registrants",
    hint: "Pending, confirmed, and waitlist — excludes cancelled and checked out.",
  },
  {
    value: "confirmed",
    label: "Confirmed",
    hint: "Approved registrations only.",
  },
  {
    value: "pending",
    label: "Pending approval",
    hint: "Awaiting staff review.",
  },
  {
    value: "waitlist",
    label: "Waitlist",
    hint: "Families on the waitlist.",
  },
  {
    value: "paid",
    label: "Paid",
    hint: "Payment received or marked paid.",
  },
  {
    value: "payment_due",
    label: "Payment due (unpaid)",
    hint: "Still expecting payment — includes pay-later and canceled checkout.",
  },
  {
    value: "checkout_pending",
    label: "Checkout pending",
    hint: "Started Stripe checkout but has not finished paying.",
  },
  {
    value: "payment_not_required",
    label: "No payment required",
    hint: "Fee waived or not applicable.",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    hint: "Cancelled registrations.",
  },
  {
    value: "checked_out",
    label: "Checked out",
    hint: "Checked out during the event week.",
  },
];

const AUDIENCE_SET = new Set<string>(COMPOSE_REGISTRANT_AUDIENCE_OPTIONS.map((o) => o.value));

export function parseComposeRegistrantAudience(raw: string): ComposeRegistrantAudience | null {
  const v = raw.trim();
  return AUDIENCE_SET.has(v) ? (v as ComposeRegistrantAudience) : null;
}
