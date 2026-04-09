import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function RegistrationsSettingsHubPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const canEdit = canManageDirectory(session.user.role);

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registration settings</h1>
        <p className="mt-1 text-foreground/70">
          Form title, window, capacity, and messages per season. Background images and field rules live under
          public settings.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">Year</th>
              {canEdit ? (
                <>
                  <th className="px-4 py-3 font-medium">Form settings</th>
                  <th className="px-4 py-3 font-medium">Public appearance</th>
                </>
              ) : (
                <th className="px-4 py-3 font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id} className="border-t border-foreground/10">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 tabular-nums">{s.year}</td>
                {canEdit ? (
                  <>
                    <td className="px-4 py-3">
                      <Link
                        href={`/registrations/forms/${s.id}/settings`}
                        className="font-medium text-brand underline hover:no-underline"
                      >
                        Open
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/seasons/${s.id}/public-settings`}
                        className="font-medium text-foreground/90 underline hover:no-underline"
                      >
                        Public settings
                      </Link>
                    </td>
                  </>
                ) : (
                  <td className="px-4 py-3 text-foreground/60">Coordinators only</td>
                )}
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
