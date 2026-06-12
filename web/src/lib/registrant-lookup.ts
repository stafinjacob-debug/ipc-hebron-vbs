import type { Prisma, RegistrationStatus } from "@/generated/prisma";

/** Registrations families can view or edit via self-service lookup. */
export const REGISTRANT_LOOKUP_ACTIVE_STATUSES: RegistrationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "WAITLIST",
];

export const registrantLookupRegistrationWhere: Prisma.RegistrationWhereInput = {
  status: { in: REGISTRANT_LOOKUP_ACTIVE_STATUSES },
};

export function registrantLookupRegistrationWhereForSeason(
  seasonId?: string | null,
): Prisma.RegistrationWhereInput {
  if (!seasonId?.trim()) return registrantLookupRegistrationWhere;
  return { ...registrantLookupRegistrationWhere, seasonId: seasonId.trim() };
}

/** Match admin registration list — guardian email on the child profile. */
export function registrantLookupRegistrationForEmail(
  emailNormalized: string,
  seasonId?: string | null,
): Prisma.RegistrationWhereInput {
  return {
    ...registrantLookupRegistrationWhereForSeason(seasonId),
    child: {
      guardian: { email: { equals: emailNormalized, mode: "insensitive" } },
    },
  };
}

export function registrantLookupSubmissionForEmail(
  emailNormalized: string,
  seasonId?: string | null,
): Prisma.FormSubmissionWhereInput {
  return {
    registrations: { some: registrantLookupRegistrationForEmail(emailNormalized, seasonId) },
  };
}

export function normalizeRegistrantLookupEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function registrantLookupEmailMatchesSubmission(args: {
  emailNormalized: string;
  submissionGuardianEmail: string | null | undefined;
  registrationGuardianEmails: Array<string | null | undefined>;
}): boolean {
  const target = args.emailNormalized;
  if (normalizeRegistrantLookupEmail(args.submissionGuardianEmail ?? "") === target) {
    return true;
  }
  return args.registrationGuardianEmails.some(
    (email) => normalizeRegistrantLookupEmail(email ?? "") === target,
  );
}

export type RegistrantLookupPickItem = {
  key: string;
  kind: "submission" | "registration";
  registrationCode: string;
  seasonName: string;
  childNames: string;
  registrationNumbers: string;
};

export type RegistrantLookupMethod = "registration_number" | "email" | "phone";

export type RegistrantLookupEmailOption = {
  emailNormalized: string;
  maskedEmail: string;
  childSummary: string;
};

export function normalizeRegistrantLookupPhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

/** Mask email for display after OTP is sent (e.g. s***@example.com). */
export function maskRegistrantLookupEmail(email: string): string {
  const normalized = normalizeRegistrantLookupEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return "***";
  if (local.length <= 1) return `*@${domain}`;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
