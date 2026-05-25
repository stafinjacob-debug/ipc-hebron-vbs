import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readRegistrantLookupSession } from "@/lib/registrant-lookup-session";
import { RegistrantEditForm } from "./registrant-edit-form";

export default async function RegistrantLookupEditPage() {
  const session = await readRegistrantLookupSession();
  if (!session) redirect("/register/lookup");

  const submission = await prisma.formSubmission.findUnique({
    where: { id: session.submissionId },
    include: {
      guardian: true,
      season: { select: { name: true } },
      registrations: {
        include: { child: true },
        orderBy: { child: { firstName: "asc" } },
      },
    },
  });

  if (!submission) redirect("/register/lookup");

  const guardianEmail = (submission.guardian.email ?? "").trim().toLowerCase();
  if (guardianEmail !== session.emailNormalized) redirect("/register/lookup");

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
