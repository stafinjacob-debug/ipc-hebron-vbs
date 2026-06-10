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

export type CheckInPacketChild = {
  firstName: string;
  lastName: string;
  registrationNumber: string;
  checkInToken: string;
  status: string;
  classroomName: string | null;
  seasonName: string;
};

export type CheckInPacketRecipient = {
  email: string;
  guardianName: string;
  children: CheckInPacketChild[];
};

export type CheckInPacketAudienceStats = {
  recipientCount: number;
  matchingRegistrations: number;
  skippedNoEmail: number;
  skippedNoCheckInIdentity: number;
  eligibleChildren: number;
};

export async function statsForCheckInPacketAudience(
  seasonId: string,
  audience: ComposeRegistrantAudience,
): Promise<CheckInPacketAudienceStats> {
  const rows = await prisma.registration.findMany({
    where: registrationWhereForAudience(seasonId, audience),
    select: {
      registrationNumber: true,
      checkInToken: true,
      child: { select: { guardian: { select: { email: true } } } },
    },
  });

  const guardiansWithEligible = new Set<string>();
  let skippedNoEmail = 0;
  let skippedNoCheckInIdentity = 0;
  let eligibleChildren = 0;

  for (const row of rows) {
    const raw = row.child.guardian.email?.trim() ?? "";
    if (!raw || !COMPOSE_TO_EMAIL_RE.test(raw)) {
      skippedNoEmail += 1;
      continue;
    }
    if (!row.registrationNumber?.trim() || !row.checkInToken?.trim()) {
      skippedNoCheckInIdentity += 1;
      continue;
    }
    eligibleChildren += 1;
    guardiansWithEligible.add(raw.toLowerCase());
  }

  return {
    recipientCount: guardiansWithEligible.size,
    matchingRegistrations: rows.length,
    skippedNoEmail,
    skippedNoCheckInIdentity,
    eligibleChildren,
  };
}

export async function recipientsForCheckInPacketAudience(
  seasonId: string,
  audience: ComposeRegistrantAudience,
): Promise<{ recipients: CheckInPacketRecipient[]; stats: CheckInPacketAudienceStats }> {
  const rows = await prisma.registration.findMany({
    where: registrationWhereForAudience(seasonId, audience),
    select: {
      registrationNumber: true,
      checkInToken: true,
      status: true,
      child: {
        select: {
          firstName: true,
          lastName: true,
          guardian: { select: { email: true, firstName: true, lastName: true } },
        },
      },
      classroom: { select: { name: true } },
      season: { select: { name: true } },
    },
    orderBy: [{ child: { firstName: "asc" } }, { child: { lastName: "asc" } }],
  });

  const byEmail = new Map<string, CheckInPacketRecipient>();
  let skippedNoEmail = 0;
  let skippedNoCheckInIdentity = 0;
  let eligibleChildren = 0;

  for (const row of rows) {
    const guardian = row.child.guardian;
    const raw = guardian.email?.trim() ?? "";
    if (!raw || !COMPOSE_TO_EMAIL_RE.test(raw)) {
      skippedNoEmail += 1;
      continue;
    }

    const registrationNumber = row.registrationNumber?.trim() ?? "";
    const checkInToken = row.checkInToken?.trim() ?? "";
    if (!registrationNumber || !checkInToken) {
      skippedNoCheckInIdentity += 1;
      continue;
    }

    eligibleChildren += 1;
    const lower = raw.toLowerCase();
    let recipient = byEmail.get(lower);
    if (!recipient) {
      recipient = {
        email: raw,
        guardianName: `${guardian.firstName} ${guardian.lastName}`.trim() || raw,
        children: [],
      };
      byEmail.set(lower, recipient);
    }

    recipient.children.push({
      firstName: row.child.firstName,
      lastName: row.child.lastName,
      registrationNumber,
      checkInToken,
      status: row.status,
      classroomName: row.classroom?.name ?? null,
      seasonName: row.season.name,
    });
  }

  const recipients = [...byEmail.values()].filter((r) => r.children.length > 0);

  return {
    recipients,
    stats: {
      recipientCount: recipients.length,
      matchingRegistrations: rows.length,
      skippedNoEmail,
      skippedNoCheckInIdentity,
      eligibleChildren,
    },
  };
}
