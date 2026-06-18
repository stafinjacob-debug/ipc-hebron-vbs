import { auth } from "@/auth";
import { ClassSettingsForm } from "@/app/(protected)/classes/class-settings-form";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ClassSettingsPage({
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
    include: { _count: { select: { classrooms: true } } },
  });

  if (seasons.length === 0) redirect("/classes");

  const defaultId = seasons.find((s) => s.isActive)?.id ?? seasons[0]!.id;
  const seasonId = sp.season?.trim() || defaultId;
  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0]!;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/classes?season=${season.id}`} className="text-sm font-medium text-brand underline">
          ← Classes
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <GraduationCap className="size-7 text-brand" aria-hidden />
          Class settings
        </h1>
        <p className="mt-1 text-muted">
          Turn class auto-assignment on or off per event. Use this for soccer camps, VBS, and other
          programs with class rosters.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {seasons.map((s) => (
          <Link
            key={s.id}
            href={`/classes/settings?season=${s.id}`}
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

      <ClassSettingsForm
        seasonId={season.id}
        seasonName={season.name}
        classroomsEnabled={season.classroomsEnabled}
        classroomCount={season._count.classrooms}
      />
    </div>
  );
}
