import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readRegistrantLookupSession } from "@/lib/registrant-lookup-session";
import {
  registrantLookupEmailMatchesSubmission,
  registrantLookupRegistrationWhere,
} from "@/lib/registrant-lookup";
import { RegistrantEditForm } from "./registrant-edit-form";

export default async function RegistrantLookupEditPage() {
  const session = await readRegistrantLookupSession();
  if (!session) redirect("/register/lookup");

  if (session.kind === "registration") {
    const reg = await prisma.registration.findUnique({
      where: { id: session.registrationId },
      include: {
        season: { select: { name: true } },
        child: { include: { guardian: true } },
      },
    });
    if (!reg) redirect("/register/lookup");
    const active =
      reg.status === "PENDING" || reg.status === "CONFIRMED" || reg.status === "WAITLIST";
    const emailOk =
      (reg.child.guardian.email ?? "").trim().toLowerCase() === session.emailNormalized;
    if (!active || !emailOk) redirect("/register/lookup");

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
          seasonName={reg.season.name}
          showGuardianJson={false}
          guardian={{
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            email: guardian.email,
            phone: guardian.phone,
          }}
          guardianResponsesJson="{}"
          children={[
            {
              registrationId: reg.id,
              firstName: reg.child.firstName,
              lastName: reg.child.lastName,
              dateOfBirth: reg.child.dateOfBirth.toISOString().slice(0, 10),
              allergiesNotes: reg.child.allergiesNotes,
              customResponsesJson: JSON.stringify(reg.customResponses ?? {}, null, 2),
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
      season: { select: { name: true } },
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
        seasonName={submission.season.name}
        showGuardianJson
        guardian={{
          firstName: submission.guardian.firstName,
          lastName: submission.guardian.lastName,
          email: submission.guardian.email,
          phone: submission.guardian.phone,
        }}
        guardianResponsesJson={JSON.stringify(submission.guardianResponses ?? {}, null, 2)}
        children={submission.registrations.map((r) => ({
          registrationId: r.id,
          firstName: r.child.firstName,
          lastName: r.child.lastName,
          dateOfBirth: r.child.dateOfBirth.toISOString().slice(0, 10),
          allergiesNotes: r.child.allergiesNotes,
          customResponsesJson: JSON.stringify(r.customResponses ?? {}, null, 2),
        }))}
      />
    </div>
  );
}
