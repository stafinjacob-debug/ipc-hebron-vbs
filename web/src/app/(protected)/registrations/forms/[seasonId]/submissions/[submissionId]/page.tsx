import { auth } from "@/auth";
import { getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { isCheckoutPendingRegistration } from "@/lib/registration-list-payment";
import { createDefaultFormDefinition } from "@/lib/registration-form-definition";
import { rulesFromDb } from "@/lib/public-registration";
import {
  buildChildFieldValues,
  buildGuardianFieldValues,
} from "@/lib/registrant-edit-form";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmissionDetailForms } from "./submission-detail-forms";

export default async function FormSubmissionDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string; submissionId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { seasonId, submissionId } = await params;
  const canEdit = canManageDirectory(session.user.role);

  const submission = await prisma.formSubmission.findFirst({
    where: { id: submissionId, seasonId },
    include: {
      guardian: true,
      form: true,
      registrations: { include: { child: true }, orderBy: { child: { firstName: "asc" } } },
      season: { include: { publicRegistrationSettings: true, registrationForm: true } },
    },
  });
  if (!submission) notFound();

  const formRow = submission.form ?? submission.season.registrationForm;
  const adminStructuredEditEnabled = Boolean(formRow?.adminRegistrationEditEnabled);

  const definition =
    getEffectiveDefinition(
      {
        publishedDefinitionJson: formRow?.publishedDefinitionJson ?? null,
        draftDefinitionJson: formRow?.draftDefinitionJson ?? null,
      },
      false,
    ) ?? createDefaultFormDefinition();
  const rules = rulesFromDb(submission.season.publicRegistrationSettings);
  const guardianResponses = (submission.guardianResponses as Record<string, unknown> | null) ?? {};

  const sampleReg = submission.registrations.find((r) => r.status !== "CANCELLED");
  const checkoutPending = sampleReg
    ? isCheckoutPendingRegistration({
        expectsPayment: sampleReg.expectsPayment,
        paymentReceivedAt: sampleReg.paymentReceivedAt,
        formSubmission: {
          stripePaymentStatus: submission.stripePaymentStatus,
          stripeCheckoutSessionId: submission.stripeCheckoutSessionId,
        },
      })
    : false;

  const responsesJson = JSON.stringify(submission.guardianResponses ?? {}, null, 2);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/registrations/forms/${seasonId}/submissions`}
          className="text-sm font-medium text-brand underline"
        >
          ← Submissions
        </Link>
        <h2 className="mt-2 text-lg font-semibold">Submission {submission.registrationCode}</h2>
        <p className="text-sm text-foreground/70">
          Submitted {submission.submittedAt.toLocaleString()} · Form version {submission.formVersion}
        </p>
      </div>

      <SubmissionDetailForms
        seasonId={seasonId}
        submissionId={submission.id}
        canEdit={canEdit}
        adminStructuredEditEnabled={canEdit && adminStructuredEditEnabled}
        definition={definition}
        rules={rules}
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
        guardian={{
          firstName: submission.guardian.firstName,
          lastName: submission.guardian.lastName,
          email: submission.guardian.email,
          phone: submission.guardian.phone,
        }}
        responsesJson={responsesJson}
        registrations={submission.registrations.map((r) => ({
          id: r.id,
          registrationNumber: r.registrationNumber,
          status: r.status,
          notes: r.notes,
          child: {
            firstName: r.child.firstName,
            lastName: r.child.lastName,
            dateOfBirth: r.child.dateOfBirth.toISOString().slice(0, 10),
            allergiesNotes: r.child.allergiesNotes,
          },
        }))}
        checkoutPending={checkoutPending}
      />
    </div>
  );
}
