import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { formatAppDateTime } from "@/lib/app-timezone";

export default async function EmbeddedFormSubmissionsPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/dashboard");

  const { formId } = await params;
  const form = await prisma.embeddedForm.findUnique({ where: { id: formId } });
  if (!form) notFound();

  const submissions = await prisma.embeddedFormSubmission.findMany({
    where: { formId },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <Link href={`/embedded-forms/${formId}`} className="text-sm text-brand hover:underline">
          ← {form.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Submissions</h1>
        <p className="text-sm text-foreground/55">{submissions.length} application(s)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase tracking-wide text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-medium">Application #</th>
              <th className="px-4 py-3 font-medium">Applicant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-b border-foreground/5 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/embedded-forms/${formId}/submissions/${s.id}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    {s.applicationNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>{s.applicantFullName}</div>
                  <div className="text-xs text-foreground/50">{s.applicantEmail}</div>
                </td>
                <td className="px-4 py-3 text-xs font-medium">{s.status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-xs text-foreground/60">
                  {formatAppDateTime(s.submittedAt)}
                </td>
                <td className="px-4 py-3 text-xs text-foreground/55">
                  {s.applicationReceivedEmailSentAt ? "Sent" : "—"}
                </td>
              </tr>
            ))}
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                  No submissions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
