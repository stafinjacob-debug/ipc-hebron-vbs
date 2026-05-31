import type { Prisma, RegistrationStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { mergeRegistrationPaymentStatusFilter } from "@/lib/registration-list-payment";
import {
  COMPOSE_TO_EMAIL_RE,
  parseComposeRegistrantAudience,
  type ComposeRegistrantAudience,
} from "@/lib/compose-registrant-audience-options";

export {
  COMPOSE_TO_EMAIL_RE,
  parseComposeRegistrantAudience,
  type ComposeRegistrantAudience,
} from "@/lib/compose-registrant-audience-options";

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
