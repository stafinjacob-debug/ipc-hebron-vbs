import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";
import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/** Child roster across seasons (same data as the former /students page). */
export default async function RegistrationsStudentsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const children = await prisma.child.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
    include: {
      guardian: true,
      _count: { select: { registrations: true } },
      registrations: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { season: { startDate: "desc" } },
        select: {
          id: true,
          season: { select: { id: true, name: true, year: true } },
          classroom: { select: { id: true, name: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users className="size-7 text-brand" aria-hidden />
          Students
        </h1>
        <p className="mt-1 text-muted">Participants and primary guardians (latest 200).</p>
      </div>

      {children.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated px-6 py-10 text-center">
          <p className="font-medium text-foreground">No students yet</p>
          <p className="mt-2 text-sm text-muted">Add a registration to create a student profile.</p>
          <Link
            href="/registrations/new"
            className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            New registration
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Date of birth</th>
                <th className="px-4 py-3 font-medium">Guardian</th>
                <th className="px-4 py-3 font-medium">Allergies / notes</th>
                <th className="px-4 py-3 font-medium">Class (by season)</th>
                <th className="px-4 py-3 font-medium">Registrations</th>
              </tr>
            </thead>
            <tbody>
              {children.map((c) => (
                <tr key={c.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">{c.dateOfBirth.toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-foreground/90">
                    {c.guardian.firstName} {c.guardian.lastName}
                    {c.guardian.phone && (
                      <span className="block text-xs text-muted">{c.guardian.phone}</span>
                    )}
                  </td>
                  <td
                    className="max-w-xs truncate px-4 py-3 text-muted"
                    title={c.allergiesNotes ?? ""}
                  >
                    {c.allergiesNotes ?? "—"}
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 text-muted">
                    {c.registrations.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="space-y-1 text-xs leading-snug">
                        {c.registrations.map((r) => (
                          <li key={r.id}>
                            <Link
                              href={`/registrations/${r.id}`}
                              className="tabular-nums text-foreground/80 underline decoration-foreground/20 hover:decoration-brand"
                            >
                              {r.season.year}
                            </Link>
                            {r.classroom ? (
                              <>
                                {" · "}
                                <Link
                                  href={`/classes/${r.classroom.id}`}
                                  className="font-medium text-brand underline"
                                >
                                  {r.classroom.name}
                                </Link>
                              </>
                            ) : (
                              <span className="text-muted"> · Unassigned</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">{c._count.registrations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
