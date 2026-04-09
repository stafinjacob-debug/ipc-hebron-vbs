import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function RegistrationsSubmissionsHubPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: {
      _count: { select: { formSubmissions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
        <p className="mt-1 text-foreground/70">
          Public form submissions by season — open a season to search, filter, and export.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Submissions</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id} className="border-t border-foreground/10">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 tabular-nums">{s.year}</td>
                <td className="px-4 py-3 tabular-nums">{s._count.formSubmissions}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/registrations/forms/${s.id}/submissions`}
                    className="font-medium text-brand underline hover:no-underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {seasons.length === 0 && (
          <p className="px-4 py-8 text-center text-foreground/60">No seasons yet.</p>
        )}
      </div>
    </div>
  );
}
