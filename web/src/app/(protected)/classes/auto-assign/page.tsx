import { auth } from "@/auth";
import { simulateAutoAssignForSeason } from "@/lib/auto-assign-simulation";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoAssignPanel } from "../auto-assign-panel";

export default async function AutoAssignPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  if (!canManageDirectory(session.user.role)) redirect("/classes");

  const sp = await searchParams;
  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true, isActive: true },
  });

  if (seasons.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted">No seasons yet.</p>
      </div>
    );
  }

  const defaultId = seasons.find((s) => s.isActive)?.id ?? seasons[0]!.id;
  const seasonId = sp.season?.trim() || defaultId;
  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0]!;

  const summary = await simulateAutoAssignForSeason(season.id);
  if (!summary) redirect("/classes");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href={`/classes?season=${season.id}`} className="text-sm font-medium text-brand underline">
          ← Classes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Simulate auto-assignment</h1>
        <p className="mt-1 text-muted">
          Preview and approve class placements for registrations that are not in a class yet.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {seasons.map((s) => (
          <Link
            key={s.id}
            href={`/classes/auto-assign?season=${s.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              s.id === season.id
                ? "border-brand bg-brand/10 font-medium text-brand"
                : "border-foreground/15 hover:bg-foreground/[0.04]"
            }`}
          >
            {s.name} ({s.year})
          </Link>
        ))}
      </div>

      <AutoAssignPanel seasonId={season.id} seasonName={season.name} initialSummary={summary} />
    </div>
  );
}
