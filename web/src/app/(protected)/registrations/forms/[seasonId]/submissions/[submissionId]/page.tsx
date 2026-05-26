import { auth } from "@/auth";
import { loadAdminSubmissionFormEditContext } from "@/lib/admin-submission-edit-context";
import { prisma } from "@/lib/prisma";
import { isCheckoutPendingRegistration } from "@/lib/registration-list-payment";
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
      registrations: { include: { child: true }, orderBy: { child: { firstName: "asc" } } },
    },
  });
  if (!submission) notFound();

  const formEditContext = await loadAdminSubmissionFormEditContext({ seasonId, submissionId });

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
  const adminStructuredEditEnabled =
    canEdit && Boolean(formEditContext?.adminStructuredEditEnabled);

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
        adminStructuredEditEnabled={adminStructuredEditEnabled}
        formEditContext={adminStructuredEditEnabled ? formEditContext : null}
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
