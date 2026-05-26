import Link from "next/link";
import { redirect } from "next/navigation";
import { getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { rulesFromDb } from "@/lib/public-registration";
import { readRegistrantLookupSession } from "@/lib/registrant-lookup-session";
import {
  registrantLookupEmailMatchesSubmission,
  registrantLookupRegistrationForEmail,
  registrantLookupRegistrationWhere,
} from "@/lib/registrant-lookup";
import {
  buildChildFieldValues,
  buildGuardianFieldValues,
} from "@/lib/registrant-edit-form";
import { createDefaultFormDefinition } from "@/lib/registration-form-definition";
import { RegistrantEditForm } from "./registrant-edit-form";

async function loadSeasonFormContext(seasonId: string) {
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: {
      publicRegistrationSettings: true,
      registrationForm: true,
    },
  });
  if (!season) return null;
  const form = season.registrationForm;
  const definition =
    getEffectiveDefinition(
      {
        publishedDefinitionJson: form?.publishedDefinitionJson ?? null,
        draftDefinitionJson: form?.draftDefinitionJson ?? null,
      },
      false,
    ) ?? createDefaultFormDefinition();
  return {
    seasonName: season.name,
    definition,
    rules: rulesFromDb(season.publicRegistrationSettings),
  };
}

export default async function RegistrantLookupEditPage() {
  const session = await readRegistrantLookupSession();
  if (!session) redirect("/register/lookup");

  if (session.kind === "registration") {
    const reg = await prisma.registration.findUnique({
      where: { id: session.registrationId },
      include: {
        season: { select: { id: true, name: true } },
        child: { include: { guardian: true } },
      },
    });
    if (!reg) redirect("/register/lookup");
    const active =
      reg.status === "PENDING" || reg.status === "CONFIRMED" || reg.status === "WAITLIST";
    const emailOk =
      (reg.child.guardian.email ?? "").trim().toLowerCase() === session.emailNormalized;
    if (!active || !emailOk) redirect("/register/lookup");

    const formContext = await loadSeasonFormContext(reg.seasonId);
    if (!formContext) redirect("/register/lookup");

    const guardian = reg.child.guardian;
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div>
          <Link href="/register/lookup" className="text-sm text-brand underline">
            ← Look up another registration
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your registration</h1>
          <p className="mt-1 text-sm text-muted">Review and update your information below.</p>
        </div>

        <RegistrantEditForm
          registrationCode={reg.registrationNumber ?? reg.id.slice(-8).toUpperCase()}
          seasonName={formContext.seasonName}
          definition={formContext.definition}
          rules={formContext.rules}
          guardianValues={buildGuardianFieldValues({
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            email: guardian.email,
            phone: guardian.phone,
            guardianResponses: {},
          })}
          children={[
            {
              registrationId: reg.id,
              values: buildChildFieldValues({
                firstName: reg.child.firstName,
                lastName: reg.child.lastName,
                dateOfBirth: reg.child.dateOfBirth.toISOString().slice(0, 10),
                allergiesNotes: reg.child.allergiesNotes,
                customResponses: (reg.customResponses as Record<string, unknown> | null) ?? {},
              }),
            },
          ]}
        />
      </div>
    );
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: session.submissionId },
    include: {
      guardian: true,
      season: { select: { id: true, name: true } },
      registrations: {
        where: registrantLookupRegistrationWhere,
        include: { child: { include: { guardian: true } } },
        orderBy: { child: { firstName: "asc" } },
      },
    },
  });

  if (!submission || submission.registrations.length === 0) redirect("/register/lookup");

  if (
    !registrantLookupEmailMatchesSubmission({
      emailNormalized: session.emailNormalized,
      submissionGuardianEmail: submission.guardian.email,
      registrationGuardianEmails: submission.registrations.map((r) => r.child.guardian.email),
    })
  ) {
    redirect("/register/lookup");
  }

  const formContext = await loadSeasonFormContext(submission.seasonId);
  if (!formContext) redirect("/register/lookup");

  const guardianResponses = (submission.guardianResponses as Record<string, unknown> | null) ?? {};

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/register/lookup" className="text-sm text-brand underline">
          ← Look up another registration
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your registration</h1>
        <p className="mt-1 text-sm text-muted">Review and update your information below.</p>
      </div>

      <RegistrantEditForm
        registrationCode={submission.registrationCode}
        seasonName={formContext.seasonName}
        definition={formContext.definition}
        rules={formContext.rules}
        guardianValues={buildGuardianFieldValues({
          firstName: submission.guardian.firstName,
          lastName: submission.guardian.lastName,
          email: submission.guardian.email,
          phone: submission.guardian.phone,
          guardianResponses,
        })}
        children={submission.registrations.map((r) => ({
          registrationId: r.id,
          values: buildChildFieldValues({
            firstName: r.child.firstName,
            lastName: r.child.lastName,
            dateOfBirth: r.child.dateOfBirth.toISOString().slice(0, 10),
            allergiesNotes: r.child.allergiesNotes,
            customResponses: (r.customResponses as Record<string, unknown> | null) ?? {},
          }),
        }))}
      />
    </div>
  );
}
