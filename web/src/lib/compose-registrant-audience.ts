import type { Prisma, RegistrationStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { mergeRegistrationPaymentStatusFilter } from "@/lib/registration-list-payment";

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

function registrationWhereForAudience(
  seasonId: string,
  audience: ComposeRegistrantAudience,
): Prisma.RegistrationWhereInput {
  const where: Prisma.RegistrationWhereInput = { seasonId };

  switch (audience) {
    case "all_active":
      where.status = { in: ["PENDING", "CONFIRMED", "WAITLIST"] satisfies RegistrationStatus[] };
      break;
    case "confirmed":
      where.status = "CONFIRMED";
      break;
    case "pending":
      where.status = "PENDING";
      break;
    case "waitlist":
      where.status = "WAITLIST";
      break;
    case "cancelled":
      where.status = "CANCELLED";
      break;
    case "checked_out":
      where.status = "CHECKED_OUT";
      break;
    case "paid":
      mergeRegistrationPaymentStatusFilter(where, "paid");
      break;
    case "payment_due":
      mergeRegistrationPaymentStatusFilter(where, "due");
      break;
    case "checkout_pending":
      mergeRegistrationPaymentStatusFilter(where, "checkout_pending");
      break;
    case "payment_not_required":
      mergeRegistrationPaymentStatusFilter(where, "not_required");
      break;
    default:
      break;
  }

  return where;
}

export type ComposeRegistrantAudienceStats = {
  recipientCount: number;
  matchingRegistrations: number;
  skippedNoEmail: number;
};

export async function statsForComposeRegistrantAudience(
  seasonId: string,
  audience: ComposeRegistrantAudience,
): Promise<ComposeRegistrantAudienceStats> {
  const rows = await prisma.registration.findMany({
    where: registrationWhereForAudience(seasonId, audience),
    select: {
      child: { select: { guardian: { select: { email: true } } } },
    },
  });

  const seen = new Set<string>();
  let skippedNoEmail = 0;

  for (const row of rows) {
    const raw = row.child.guardian.email?.trim() ?? "";
    if (!raw || !COMPOSE_TO_EMAIL_RE.test(raw)) {
      skippedNoEmail += 1;
      continue;
    }
    seen.add(raw.toLowerCase());
  }

  return {
    recipientCount: seen.size,
    matchingRegistrations: rows.length,
    skippedNoEmail,
  };
}

export async function guardianEmailsForComposeRegistrantAudience(
  seasonId: string,
  audience: ComposeRegistrantAudience,
): Promise<{ emails: string[]; stats: ComposeRegistrantAudienceStats }> {
  const rows = await prisma.registration.findMany({
    where: registrationWhereForAudience(seasonId, audience),
    select: {
      child: {
        select: {
          guardian: { select: { email: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  const byEmail = new Map<string, { email: string; name: string }>();
  let skippedNoEmail = 0;

  for (const row of rows) {
    const guardian = row.child.guardian;
    const raw = guardian.email?.trim() ?? "";
    if (!raw || !COMPOSE_TO_EMAIL_RE.test(raw)) {
      skippedNoEmail += 1;
      continue;
    }
    const lower = raw.toLowerCase();
    if (byEmail.has(lower)) continue;
    const name = `${guardian.firstName} ${guardian.lastName}`.trim() || raw;
    byEmail.set(lower, { email: raw, name });
  }

  const emails = [...byEmail.values()].map((g) => g.email);

  return {
    emails,
    stats: {
      recipientCount: emails.length,
      matchingRegistrations: rows.length,
      skippedNoEmail,
    },
  };
}
