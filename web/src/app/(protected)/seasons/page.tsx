import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SeasonsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: { _count: { select: { classrooms: true, registrations: true } } },
  });

  const canEditPublic = canManageDirectory(session.user.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">VBS seasons</h1>
        <p className="mt-1 text-foreground/70">Camp years, dates, and themes.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Theme</th>
              <th className="px-4 py-3 font-medium">Classes</th>
              <th className="px-4 py-3 font-medium">Registrations</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Public signup</th>
              {canEditPublic && (
                <>
                  <th className="px-4 py-3 font-medium">Registration form</th>
                  <th className="px-4 py-3 font-medium">Public form</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id} className="border-t border-foreground/10">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 tabular-nums">{s.year}</td>
                <td className="px-4 py-3 text-foreground/80">
                  {s.startDate.toLocaleDateString()} – {s.endDate.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-foreground/70">{s.theme ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{s._count.classrooms}</td>
                <td className="px-4 py-3 tabular-nums">{s._count.registrations}</td>
                <td className="px-4 py-3">
                  {s.isActive ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                  ) : (
                    <span className="text-foreground/50">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {s.publicRegistrationOpen ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Open</span>
                  ) : (
                    <span className="text-foreground/50">Closed</span>
                  )}
                </td>
                {canEditPublic && (
                  <>
                    <td className="px-4 py-3">
                      <Link
                        href={`/registrations/forms/${s.id}`}
                        className="text-sm font-medium text-foreground/90 underline hover:no-underline"
                      >
                        Manage
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/seasons/${s.id}/public-settings`}
                        className="text-sm font-medium text-foreground/90 underline hover:no-underline"
                      >
                        Settings
                      </Link>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {seasons.length === 0 && (
          <p className="px-4 py-8 text-center text-foreground/60">No seasons yet. Run db seed or add data.</p>
        )}
      </div>
    </div>
  );
}
