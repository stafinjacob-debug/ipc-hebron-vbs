import type { Prisma, RegistrationStatus } from "@/generated/prisma";

/** Registrations visible in family self-service lookup (pending approval or approved). */
export const REGISTRANT_LOOKUP_ACTIVE_STATUSES: RegistrationStatus[] = ["PENDING", "CONFIRMED"];

export const registrantLookupRegistrationWhere: Prisma.RegistrationWhereInput = {
  status: { in: REGISTRANT_LOOKUP_ACTIVE_STATUSES },
};

export const registrantLookupSubmissionWhere: Prisma.FormSubmissionWhereInput = {
  registrations: { some: registrantLookupRegistrationWhere },
};
