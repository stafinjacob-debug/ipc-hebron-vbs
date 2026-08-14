import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import { ensureEmbeddedFormsForAdmin, createBlankEmbeddedFormAction } from "./actions";

export default async function EmbeddedFormsListPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/dashboard");

  await ensureEmbeddedFormsForAdmin();

  const forms = await prisma.embeddedForm.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });
  const publicBase = await getPublicBaseUrl();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Embedded Forms</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Standalone application forms with dedicated emails and printable PDF exports. Separate from
            event registrations.
          </p>
        </div>
        <form
          action={async (fd) => {
            "use server";
            const result = await createBlankEmbeddedFormAction(fd);
            if (result.ok) redirect(`/embedded-forms/${result.formId}`);
          }}
        >
          <input type="hidden" name="title" value="New embedded form" />
          <button
            type="submit"
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            New blank form
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase tracking-wide text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-medium">Form</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submissions</th>
              <th className="px-4 py-3 font-medium">Public link</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => {
              const publicUrl = `${publicBase}/forms/${form.slug}`;
              return (
                <tr key={form.id} className="border-b border-foreground/5 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/embedded-forms/${form.id}`}
                      className="font-semibold text-foreground hover:text-brand"
                    >
                      {form.title}
                    </Link>
                    {form.subtitle ? (
                      <div className="text-xs text-foreground/50">{form.subtitle}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium">
                      {form.status}
                    </span>
                    {form.publishedVersion > 0 ? (
                      <span className="ml-2 text-xs text-foreground/45">v{form.publishedVersion}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/embedded-forms/${form.id}/submissions`}
                      className="text-brand hover:underline"
                    >
                      {form._count.submissions}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {form.status === "PUBLISHED" ? (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-xs text-brand hover:underline"
                      >
                        {publicUrl}
                      </a>
                    ) : (
                      <span className="text-xs text-foreground/40">Publish to share</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {forms.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-foreground/50">
                  No embedded forms yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
