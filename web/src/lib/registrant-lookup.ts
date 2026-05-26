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

/** Match admin registration list — guardian email on the child profile. */
export function registrantLookupRegistrationForEmail(
  emailNormalized: string,
): Prisma.RegistrationWhereInput {
  return {
    ...registrantLookupRegistrationWhere,
    child: {
      guardian: { email: { equals: emailNormalized, mode: "insensitive" } },
    },
  };
}

export function registrantLookupSubmissionForEmail(
  emailNormalized: string,
): Prisma.FormSubmissionWhereInput {
  return {
    registrations: { some: registrantLookupRegistrationForEmail(emailNormalized) },
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
