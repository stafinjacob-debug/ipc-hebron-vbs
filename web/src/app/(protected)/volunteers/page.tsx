import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageVolunteersModule } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function VolunteersPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageVolunteersModule(session.user.role)) redirect("/dashboard");

  const profiles = await prisma.volunteerProfile.findMany({
    orderBy: { displayName: "asc" },
    include: {
      user: { select: { email: true } },
      assignments: {
        include: { season: true, classroom: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
        <p className="mt-1 text-foreground/70">Profiles linked to staff accounts and assignments.</p>
      </div>

      <div className="space-y-4">
        {profiles.map((p) => (
          <article
            key={p.id}
            className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{p.displayName}</h2>
              <span className="text-sm text-foreground/60">{p.user.email}</span>
            </div>
            <p className="mt-1 text-sm text-foreground/70">
              Background check: {p.backgroundCheckOk ? "Recorded" : "Not recorded"}
              {p.phone && ` · ${p.phone}`}
            </p>
            <ul className="mt-3 list-inside list-disc text-sm text-foreground/80">
              {p.assignments.map((a) => (
                <li key={a.id}>
                  {a.roleTitle} — {a.season.name}
                  {a.classroom ? ` · ${a.classroom.name}` : ""}
                </li>
              ))}
              {p.assignments.length === 0 && <li>No assignments for any season.</li>}
            </ul>
          </article>
        ))}
        {profiles.length === 0 && (
          <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-foreground/60">
            No volunteer profiles yet.
          </p>
        )}
      </div>
    </div>
  );
}
