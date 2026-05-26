import { getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { rulesFromDb, type PublicRegistrationFieldRules } from "@/lib/public-registration";
import {
  buildChildFieldValues,
  buildGuardianFieldValues,
} from "@/lib/registrant-edit-form";
import { createDefaultFormDefinition, type FormDefinitionV1 } from "@/lib/registration-form-definition";

export type AdminSubmissionFormEditContext = {
  submissionId: string;
  adminStructuredEditEnabled: boolean;
  definition: FormDefinitionV1;
  rules: PublicRegistrationFieldRules;
  guardianValues: Record<string, string>;
  childFormRows: Array<{ registrationId: string; values: Record<string, string> }>;
};

export async function loadAdminSubmissionFormEditContext(args: {
  seasonId: string;
  submissionId: string;
}): Promise<AdminSubmissionFormEditContext | null> {
  const submission = await prisma.formSubmission.findFirst({
    where: { id: args.submissionId, seasonId: args.seasonId },
    include: {
      guardian: true,
      registrations: { include: { child: true }, orderBy: { child: { firstName: "asc" } } },
      season: { include: { publicRegistrationSettings: true, registrationForm: true } },
    },
  });
  if (!submission) return null;

  const seasonForm = submission.season.registrationForm;
  const adminStructuredEditEnabled = seasonForm?.adminRegistrationEditEnabled ?? true;

  const definition =
    getEffectiveDefinition(
      {
        publishedDefinitionJson: seasonForm?.publishedDefinitionJson ?? null,
        draftDefinitionJson: seasonForm?.draftDefinitionJson ?? null,
      },
      false,
    ) ?? createDefaultFormDefinition();

  const guardianResponses = (submission.guardianResponses as Record<string, unknown> | null) ?? {};

  return {
    submissionId: submission.id,
    adminStructuredEditEnabled,
    definition,
    rules: rulesFromDb(submission.season.publicRegistrationSettings),
    guardianValues: buildGuardianFieldValues({
      firstName: submission.guardian.firstName,
      lastName: submission.guardian.lastName,
      email: submission.guardian.email,
      phone: submission.guardian.phone,
      guardianResponses,
    }),
    childFormRows: submission.registrations.map((r) => ({
      registrationId: r.id,
      values: buildChildFieldValues({
        firstName: r.child.firstName,
        lastName: r.child.lastName,
        dateOfBirth: r.child.dateOfBirth.toISOString().slice(0, 10),
        allergiesNotes: r.child.allergiesNotes,
        customResponses: (r.customResponses as Record<string, unknown> | null) ?? {},
      }),
    })),
  };
}
