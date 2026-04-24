import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";
import type { Prisma } from "@/generated/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function RegistrationsSubmissionsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; q?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim().toUpperCase() ?? "";
  const seasonId = sp.season?.trim() ?? "";
  const allowed = new Set(["PENDING", "CONFIRMED", "CANCELLED", "WAITLIST", "DRAFT", "CHECKED_OUT"]);
  const statusOk = status && allowed.has(status) ? status : "";

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true },
  });
  const activeSeasonId = seasonId || seasons[0]?.id || "";

  const where: Prisma.FormSubmissionWhereInput = activeSeasonId ? { seasonId: activeSeasonId } : {};
  if (q) {
    where.AND = [
      {
        OR: [
          { registrationCode: { contains: q, mode: "insensitive" } },
          { guardian: { email: { contains: q, mode: "insensitive" } } },
          { guardian: { firstName: { contains: q, mode: "insensitive" } } },
          { guardian: { lastName: { contains: q, mode: "insensitive" } } },
          { guardian: { phone: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }
  if (statusOk) {
    where.registrations = { some: { status: statusOk as never } };
  }

  const rows = activeSeasonId
    ? await prisma.formSubmission.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        include: {
          guardian: true,
          registrations: { include: { child: true } },
        },
        take: 200,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
        <p className="mt-1 text-foreground/70">
          View and expand public form submissions directly here by season — no separate submissions page needed.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="season" className="block text-xs font-medium text-foreground/70">
            Season
          </label>
          <select
            id="season"
            name="season"
            defaultValue={activeSeasonId}
            className="mt-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="q" className="block text-xs font-medium text-foreground/70">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Code, email, name, phone"
            className="mt-1 min-w-[220px] rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-foreground/70">
            Has child status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusOk}
            className="mt-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            {["PENDING", "CONFIRMED", "WAITLIST", "CANCELLED", "CHECKED_OUT", "DRAFT"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Filter
        </button>
        {activeSeasonId ? (
          <Link
            href={`/registrations/forms/${activeSeasonId}/submissions/export`}
            className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
          >
            Export CSV
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Guardian</th>
              <th className="px-4 py-3 font-medium">Children</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-foreground/10 align-top">
                <td className="px-4 py-3 font-mono text-xs">{s.registrationCode}</td>
                <td className="px-4 py-3">
                  {s.guardian.firstName} {s.guardian.lastName}
                  <br />
                  <span className="text-foreground/60">{s.guardian.email ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-foreground/80">
                  {s.registrations
                    .map((r) => `${r.child.firstName} (${r.status})`)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-foreground/70">{s.submittedAt.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <details className="group">
                    <summary className="cursor-pointer list-none text-sm font-medium text-brand underline hover:no-underline">
                      Expand
                    </summary>
                    <div className="mt-2 space-y-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 text-xs">
                      <p className="text-foreground/70">
                        Phone: {s.guardian.phone ?? "—"} · Children: {s.registrations.length}
                      </p>
                      <ul className="space-y-1">
                        {s.registrations.map((r) => (
                          <li key={r.id} className="text-foreground/80">
                            {r.child.firstName} {r.child.lastName} · {r.child.dateOfBirth.toLocaleDateString()} ·{" "}
                            <span className="font-medium">{r.status}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/registrations/forms/${activeSeasonId}/submissions/${s.id}`}
                        className="inline-block font-medium text-brand underline hover:no-underline"
                      >
                        Open full edit view
                      </Link>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-foreground/60">No submissions match.</p>
        )}
      </div>
    </div>
  );
}
