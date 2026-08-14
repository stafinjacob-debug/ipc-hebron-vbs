import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { formatAppDateTime } from "@/lib/app-timezone";
import {
  parseEmbeddedFormDefinitionJson,
  applicantVisibleSections,
  fieldsForEmbeddedSection,
  isFillableEmbeddedField,
} from "@/lib/embedded-form-definition";
import { responseToDisplayString } from "@/lib/embedded-form-validate";
import { parseAcademicDocumentKeys } from "@/lib/embedded-document-storage";
import { formatUsdFromCents } from "@/lib/stripe-fee-math";
import { EmbeddedSubmissionAdminActions } from "./submission-admin-actions";

export default async function EmbeddedSubmissionDetailPage({
  params,
}: {
  params: Promise<{ formId: string; submissionId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/dashboard");

  const { formId, submissionId } = await params;
  const submission = await prisma.embeddedFormSubmission.findFirst({
    where: { id: submissionId, formId },
    include: { form: true },
  });
  if (!submission) notFound();

  const def =
    parseEmbeddedFormDefinitionJson(submission.definitionSnapshotJson) ||
    parseEmbeddedFormDefinitionJson(submission.form.publishedDefinitionJson);
  const responses = (submission.responsesJson ?? {}) as Record<string, unknown>;
  const registrarRaw = (submission.registrarResponsesJson ?? {}) as Record<string, unknown>;
  const registrar: Record<string, string> = {};
  for (const [k, v] of Object.entries(registrarRaw)) {
    registrar[k] = responseToDisplayString(v);
  }
  const docKeys = parseAcademicDocumentKeys(submission.academicDocumentKeys);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <Link
          href={`/embedded-forms/${formId}/submissions`}
          className="text-sm text-brand hover:underline"
        >
          ← Submissions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{submission.applicantFullName}</h1>
        <p className="text-sm text-foreground/60">
          {submission.applicationNumber} · {submission.status.replaceAll("_", " ")} · submitted{" "}
          {formatAppDateTime(submission.submittedAt)}
        </p>
        <p className="mt-1 text-sm text-foreground/60">
          Payment:{" "}
          {submission.stripePaymentStatus === "paid"
            ? `Paid${
                submission.stripeAmountChargedCents != null
                  ? ` (${formatUsdFromCents(submission.stripeAmountChargedCents)})`
                  : ""
              }`
            : submission.stripePaymentStatus === "pending"
              ? "Pending Stripe checkout"
              : "Not required / not started"}
        </p>
      </div>

      <EmbeddedSubmissionAdminActions
        submissionId={submission.id}
        registrar={registrar}
        emailSentAt={
          submission.applicationReceivedEmailSentAt
            ? formatAppDateTime(submission.applicationReceivedEmailSentAt)
            : null
        }
      />

      {submission.photoObjectKey ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4">
          <h2 className="text-sm font-semibold">Passport photo</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/embedded-forms/submissions/${submission.id}/photo`}
            alt="Applicant passport photo"
            className="mt-3 h-40 w-32 rounded-md border border-foreground/10 object-cover"
          />
        </div>
      ) : null}

      {docKeys.length > 0 ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4">
          <h2 className="text-sm font-semibold">Academic documents</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {docKeys.map((_, i) => (
              <li key={i}>
                <a
                  href={`/api/embedded-forms/submissions/${submission.id}/document?i=${i}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  Document {i + 1}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {def
        ? applicantVisibleSections(def).map((section) => {
            const fields = fieldsForEmbeddedSection(def, section.id).filter(isFillableEmbeddedField);
            if (!fields.length) return null;
            return (
              <section
                key={section.id}
                className="rounded-xl border border-foreground/10 bg-surface-elevated p-4"
              >
                <h2 className="text-base font-semibold">{section.title}</h2>
                <dl className="mt-3 space-y-3">
                  {fields.map((field) => {
                    if (field.type === "photo" || field.type === "documentUploads") return null;
                    const value = responseToDisplayString(responses[field.key]);
                    return (
                      <div key={field.id}>
                        <dt className="text-xs font-medium uppercase tracking-wide text-foreground/45">
                          {field.label}
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                          {value || "—"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })
        : null}
    </div>
  );
}
