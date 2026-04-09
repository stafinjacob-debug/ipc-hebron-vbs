import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function RegistrationsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const rows = await prisma.registration.findMany({
    orderBy: { registeredAt: "desc" },
    take: 100,
    include: {
      child: { include: { guardian: true } },
      season: true,
      classroom: true,
    },
  });

  const canAdd = canManageDirectory(session.user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-foreground/70">
            Recent child enrollments across seasons (latest 100). Use{" "}
            <strong className="font-medium text-foreground/80">Form builder</strong> for public signup and{" "}
            <strong className="font-medium text-foreground/80">Submissions</strong> for parent entries.
          </p>
        </div>
        {canAdd && (
          <Link
            href="/registrations/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            New registration
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Child</th>
              <th className="px-4 py-3 font-medium">Reg #</th>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Registered</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-4 py-3">
                  {r.child.firstName} {r.child.lastName}
                  {r.child.guardian.email ? (
                    <span className="mt-0.5 block text-xs text-foreground/50">{r.child.guardian.email}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-medium text-foreground/90">
                  {r.registrationNumber ?? "Pending approval"}
                </td>
                <td className="px-4 py-3">{r.season.name}</td>
                <td className="px-4 py-3 text-foreground/80">{r.classroom?.name ?? "—"}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3 text-foreground/70">
                  {r.registeredAt.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/registrations/${r.id}`}
                    className="font-medium text-brand underline hover:no-underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-foreground/60">No registrations yet.</p>
        )}
      </div>
    </div>
  );
}
