import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findDuplicateRegistrationGroups } from "@/lib/registration-duplicates";
import { canViewOperations } from "@/lib/roles";
import { formatAppDateTime } from "@/lib/app-timezone";
import Link from "next/link";
import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ season?: string }> };

export default async function RegistrationDuplicatesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true, isActive: true },
  });

  const seasonId = sp.season?.trim() || seasons.find((s) => s.isActive)?.id || seasons[0]?.id || "";
  const groups = seasonId
    ? await findDuplicateRegistrationGroups({ seasonId, limit: 200 })
    : await findDuplicateRegistrationGroups({ limit: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Possible duplicate registrations</h1>
        <p className="mt-1 text-sm text-muted">
          Groups where the same child name and guardian email appear more than once in a season. Review
          carefully — some may be legitimate (twins with same email, re-submissions).
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-foreground/10 bg-surface-elevated p-4">
        <div>
          <label htmlFor="season" className="block text-xs font-medium text-foreground/70">
            Season
          </label>
          <select
            id="season"
            name="season"
            defaultValue={seasonId}
            className="mt-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year}){s.isActive ? " — active" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Scan season
        </button>
        <Link href="/registrations" className="text-sm font-medium text-brand underline">
          Back to registrations
        </Link>
      </form>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated px-6 py-10 text-center text-sm text-muted">
          No duplicate groups found for this season (matching guardian email + child first and last name).
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            <strong className="text-foreground">{groups.length}</strong> duplicate group
            {groups.length === 1 ? "" : "s"} found.
          </p>
          {groups.map((g) => (
            <section
              key={g.fingerprint}
              className="overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/[0.04]"
            >
              <div className="border-b border-amber-500/20 px-4 py-3">
                <p className="font-semibold text-foreground">{g.childName}</p>
                <p className="text-sm text-muted">
                  {g.guardianEmail} · {g.seasonName} · {g.registrations.length} registrations
                </p>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/[0.03] text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Reg #</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Registered</th>
                    <th className="px-4 py-2 font-medium text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {g.registrations.map((r) => (
                    <tr key={r.id} className="border-t border-foreground/10">
                      <td className="px-4 py-2 font-mono text-xs">{r.registrationNumber ?? "—"}</td>
                      <td className="px-4 py-2">{r.status}</td>
                      <td className="px-4 py-2 text-muted">
                        {formatAppDateTime(r.registeredAt, { timeZoneName: undefined })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/registrations/${r.id}`} className="font-medium text-brand underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
