import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatSeasonDateRange } from "@/lib/season-calendar-date";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassSettingsForm } from "./settings-form";

type Props = { params: Promise<{ seasonId: string }> };

export default async function ClassSettingsPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  if (!canManageDirectory(session.user.role)) redirect("/seasons");

  const { seasonId } = await params;
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { _count: { select: { classrooms: true } } },
  });
  if (!season) redirect("/seasons");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href="/seasons" className="text-brand underline">
            ← Programs
          </Link>
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <GraduationCap className="size-7 text-brand" aria-hidden />
          Class settings
        </h1>
        <p className="mt-1 text-muted">
          {season.name} ({season.year}) · {formatSeasonDateRange(season.startDate, season.endDate)}
        </p>
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
