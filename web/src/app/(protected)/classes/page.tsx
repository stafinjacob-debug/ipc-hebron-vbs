import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ageRangeOverlaps } from "@/lib/class-assignment";
import {
  classroomWhereForTeacher,
  getEnrollmentCountsByClassroom,
} from "@/lib/classroom-enrollment";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassesOverview, type ClassOverviewRow } from "./classes-overview";

function overlapIdSet(
  list: { id: string; ageMin: number; ageMax: number; isActive: boolean }[],
): Set<string> {
  const active = list.filter((c) => c.isActive);
  const ids = new Set<string>();
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (ageRangeOverlaps(a.ageMin, a.ageMax, b.ageMin, b.ageMax)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const canManage = canManageDirectory(session.user.role);
  const isTeacher = session.user.role === "TEACHER";
  const userId = session.user.id;

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true, isActive: true },
  });

  if (seasons.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <GraduationCap className="size-7 text-brand" aria-hidden />
          Classes
        </h1>
        <p className="text-muted">Create a VBS season first, then add classes for that year.</p>
        <Link href="/seasons" className="inline-flex text-sm font-medium text-brand underline">
          VBS seasons
        </Link>
      </div>
    );
  }

  const defaultSeasonId =
    seasons.find((s) => s.isActive)?.id ?? seasons[0]?.id ?? "";
  const seasonId = sp.season?.trim() || defaultSeasonId;
  const filterStatus = sp.status?.trim() || "all";

  const seasonMeta = seasons.find((s) => s.id === seasonId) ?? seasons[0]!;

  const whereBase = {
    seasonId: seasonMeta.id,
    ...(isTeacher ? classroomWhereForTeacher(userId) : {}),
  };

  const classrooms = await prisma.classroom.findMany({
    where: whereBase,
    include: {
      season: { select: { name: true, year: true, startDate: true } },
      leaderAssignments: {
        include: { user: { select: { name: true, email: true } } },
      },
      _count: {
        select: {
          registrations: { where: { status: { not: "CANCELLED" } } },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const allInSeason = await prisma.classroom.findMany({
    where: { seasonId: seasonMeta.id },
    select: { id: true, ageMin: true, ageMax: true, isActive: true },
  });
  const overlapIds = overlapIdSet(allInSeason);

  const counts = await getEnrollmentCountsByClassroom(seasonMeta.id);

  const rows: ClassOverviewRow[] = classrooms.map((c) => {
    const ec = counts.get(c.id) ?? { seated: 0, waitlisted: 0 };
    const leaderNames = [...c.leaderAssignments]
      .sort((a, b) => {
        const order = (r: string) => (r === "PRIMARY" ? 0 : 1);
        return order(a.role) - order(b.role);
      })
      .map((a) => a.user.name?.trim() || a.user.email);

    return {
      id: c.id,
      name: c.name,
      seasonId: c.seasonId,
      seasonName: c.season.name,
      seasonYear: c.season.year,
      seasonStart: c.season.startDate.toISOString(),
      ageMin: c.ageMin,
      ageMax: c.ageMax,
      ageRule: c.ageRule,
      room: c.room,
      capacity: c.capacity,
      seated: ec.seated,
      waitlisted: ec.waitlisted,
      intakeStatus: c.intakeStatus,
      isActive: c.isActive,
      waitlistEnabled: c.waitlistEnabled,
      leaderNames,
      hasOverlap: overlapIds.has(c.id),
      regCountNonCancelled: c._count.registrations,
    };
  });

  const seasonOptions = seasons.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.year})${s.isActive ? " · active" : ""}`,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <GraduationCap className="size-7 text-brand" aria-hidden />
            Classes
          </h1>
          <p className="mt-1 text-muted">
            Age-based groups, capacity, leaders, and rosters per VBS season. New registrations are
            placed automatically when classes are configured.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <>
              <Link
                href={`/classes/assignment-rules?season=${seasonMeta.id}`}
                className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
              >
                Assignment rules
              </Link>
              <Link
                href={`/classes/new?season=${seasonMeta.id}`}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
              >
                New class
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <ClassesOverview
        rows={rows}
        canManage={canManage}
        seasonOptions={seasonOptions}
        currentSeasonId={seasonMeta.id}
        filterStatus={filterStatus}
      />

      {isTeacher ? (
        <p className="text-xs text-muted">
          You are viewing classes you lead or are scoped to. Contact an admin for broader access.
        </p>
      ) : null}
    </div>
  );
}
