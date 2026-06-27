import type { Prisma } from "@/generated/prisma";
import { resolveParticipantDateOfBirth } from "@/lib/participant-dob-resolve";
import type { RegistrantEditParseResult } from "@/lib/registrant-edit-form";
import { syncSubmissionPaymentExpectation } from "@/lib/sync-submission-payment-expectation";

type ParsedSubmission = Extract<RegistrantEditParseResult, { ok: true }>;

type RegistrationRow = {
  id: string;
  childId: string;
  customResponses: unknown;
};

export async function persistSubmissionFormEntries(
  tx: Prisma.TransactionClient,
  args: {
    submissionId: string;
    guardianId: string;
    priorGuardianResponses: Record<string, unknown>;
    parsed: ParsedSubmission;
    registrations: RegistrationRow[];
    seasonStartDate: Date;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const childByRegId = new Map(args.parsed.children.map((c) => [c.registrationId, c]));
  const allowedIds = new Set(args.registrations.map((r) => r.id));

  if (!args.parsed.children.every((c) => allowedIds.has(c.registrationId))) {
    return { ok: false, message: "One or more registrations could not be updated." };
  }

  const guardianResponses: Record<string, unknown> = {
    ...args.priorGuardianResponses,
    ...args.parsed.guardianCustom,
  };

  try {
    await tx.guardian.update({
      where: { id: args.guardianId },
      data: {
        firstName: args.parsed.guardian.guardianFirstName,
        lastName: args.parsed.guardian.guardianLastName,
        email: args.parsed.guardian.guardianEmail ?? null,
        phone: args.parsed.guardian.guardianPhone ?? null,
      },
    });
    await tx.formSubmission.update({
      where: { id: args.submissionId },
      data: { guardianResponses: guardianResponses as object },
    });

    for (const reg of args.registrations) {
      const child = childByRegId.get(reg.id);
      if (!child) continue;
      const childDob = resolveParticipantDateOfBirth({
        childDateOfBirth: child.childDateOfBirth,
        custom: child.custom,
        seasonStartDate: args.seasonStartDate,
      });
      const priorCustom = (reg.customResponses as Record<string, unknown> | null) ?? {};
      await tx.registration.update({
        where: { id: reg.id },
        data: { customResponses: { ...priorCustom, ...child.custom } as object },
      });
      await tx.child.update({
        where: { id: reg.childId },
        data: {
          firstName: child.childFirstName,
          lastName: child.childLastName,
          dateOfBirth: childDob,
          allergiesNotes: child.allergiesNotes,
        },
      });
    }
  } catch {
    return { ok: false, message: "Enter a valid date of birth for each child." };
  }

  await syncSubmissionPaymentExpectation(args.submissionId, tx);

  return { ok: true };
}

export async function persistSingleRegistrationFormEntries(
  tx: Prisma.TransactionClient,
  args: {
    registrationId: string;
    guardianId: string;
    childId: string;
    priorCustom: Record<string, unknown>;
    parsed: ParsedSubmission;
    seasonStartDate: Date;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const child = args.parsed.children[0];
  if (!child || child.registrationId !== args.registrationId) {
    return { ok: false, message: "Registration data mismatch." };
  }

  try {
    const childDob = resolveParticipantDateOfBirth({
      childDateOfBirth: child.childDateOfBirth,
      custom: child.custom,
      seasonStartDate: args.seasonStartDate,
    });
    await tx.guardian.update({
      where: { id: args.guardianId },
      data: {
        firstName: args.parsed.guardian.guardianFirstName,
        lastName: args.parsed.guardian.guardianLastName,
        email: args.parsed.guardian.guardianEmail ?? null,
        phone: args.parsed.guardian.guardianPhone ?? null,
      },
    });
    await tx.registration.update({
      where: { id: args.registrationId },
      data: { customResponses: { ...args.priorCustom, ...child.custom } as object },
    });
    await tx.child.update({
      where: { id: args.childId },
      data: {
        firstName: child.childFirstName,
        lastName: child.childLastName,
        dateOfBirth: childDob,
        allergiesNotes: child.allergiesNotes,
      },
    });
  } catch {
    return { ok: false, message: "Enter a valid date of birth." };
  }

  return { ok: true };
}
