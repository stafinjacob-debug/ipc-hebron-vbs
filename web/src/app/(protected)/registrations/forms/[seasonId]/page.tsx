import { auth } from "@/auth";
import { isFormRegistrationOpen } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CloneRegistrationForm } from "./clone-form";
import { LifecycleActions } from "./lifecycle-actions";

export default async function RegistrationFormHubPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { seasonId } = await params;
  const canEdit = canManageDirectory(session.user.role);

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: {
      registrationForm: true,
      publicRegistrationSettings: true,
      _count: { select: { registrations: true } },
    },
  });
  if (!season) notFound();

  const form = season.registrationForm;
  if (!form) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-6 text-sm">
        <p className="font-medium text-foreground">No registration form row yet.</p>
        {canEdit ? (
          <p className="mt-2 text-foreground/80">
            Open the{" "}
            <Link href="/registrations/forms" className="underline">
              forms list
            </Link>{" "}
            as a coordinator — a form record will be created automatically — or visit the editor.
          </p>
        ) : (
          <p className="mt-2 text-foreground/80">Ask a coordinator to set up this season&apos;s form.</p>
        )}
      </div>
    );
  }

  const audit = await prisma.registrationFormAuditLog.findMany({
    where: { formId: form.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const windowOk = isFormRegistrationOpen(form);
  const accepting =
    form.status === "PUBLISHED" &&
    windowOk &&
    season.publicRegistrationOpen &&
    !!form.publishedDefinitionJson;

  const otherSeasons = await prisma.vbsSeason.findMany({
    where: { id: { not: seasonId } },
    orderBy: [{ year: "desc" }],
    select: { id: true, name: true, year: true },
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-foreground/10 px-4 py-3">
          <p className="text-xs font-medium uppercase text-foreground/60">Form status</p>
          <p className="mt-1 text-lg font-semibold">{form.status}</p>
          <p className="text-sm text-foreground/60">Published v{form.publishedVersion}</p>
        </div>
        <div className="rounded-xl border border-foreground/10 px-4 py-3">
          <p className="text-xs font-medium uppercase text-foreground/60">Live signup</p>
          <p className="mt-1 text-lg font-semibold">{accepting ? "Yes" : "No"}</p>
          <p className="text-sm text-foreground/60">
            {season.publicRegistrationOpen ? "Season gate open" : "Season gate closed"}
          </p>
        </div>
        <div className="rounded-xl border border-foreground/10 px-4 py-3">
          <p className="text-xs font-medium uppercase text-foreground/60">Registrations</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{season._count.registrations}</p>
          <Link
            href={`/registrations?season=${encodeURIComponent(seasonId)}`}
            className="text-sm font-medium text-brand underline"
          >
            View in staff list
          </Link>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <LifecycleActions seasonId={seasonId} status={form.status} />
          <Link
            href={`/registrations/form-workspace/${seasonId}`}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Open form workspace
          </Link>
          <Link
            href={`/registrations/form-workspace/${seasonId}?tab=settings`}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
          >
            Settings & capacity
          </Link>
        </div>
      )}

      {canEdit && otherSeasons.length > 0 && (
        <div className="rounded-xl border border-foreground/10 p-4">
          <h2 className="text-sm font-semibold">Clone from another season</h2>
          <p className="mt-1 text-sm text-foreground/70">
            Copies draft field layout and form messages into this season. Does not copy submissions.
          </p>
          <div className="mt-3">
            <CloneRegistrationForm targetSeasonId={seasonId} seasons={otherSeasons} />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/[0.04] text-foreground/70">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-foreground/10">
                  <td className="px-4 py-2 text-foreground/70">{a.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium">{a.action}</td>
                  <td className="px-4 py-2 text-foreground/70 font-mono text-xs">
                    {a.metadata ? JSON.stringify(a.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-foreground/60">No audit entries yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
