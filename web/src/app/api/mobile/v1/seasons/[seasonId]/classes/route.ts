import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { canUseCheckInActions } from "@/lib/permissions";

type RouteParams = { params: Promise<{ seasonId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canUseCheckInActions(auth.role)) {
    return jsonError(403, "Classes are not available for your role");
  }

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const classrooms = await prisma.classroom.findMany({
    where: { seasonId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      leaderAssignments: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      _count: {
        select: {
          registrations: {
            where: { status: { not: "CANCELLED" } },
          },
        },
      },
    },
  });

  const withChecked = await Promise.all(
    classrooms.map(async (c) => {
      const checkedIn = await prisma.registration.count({
        where: {
          classroomId: c.id,
          seasonId,
          status: { not: "CANCELLED" },
          checkedInAt: { not: null },
        },
      });
      const primary = c.leaderAssignments.find((l) => l.role === "PRIMARY");
      const leaderName =
        primary?.user?.name ??
        primary?.user?.email ??
        c.leaderAssignments[0]?.user?.name ??
        c.leaderAssignments[0]?.user?.email ??
        null;
      return {
        id: c.id,
        name: c.name,
        ageMin: c.ageMin,
        ageMax: c.ageMax,
        gradeLabel: c.gradeLabel,
        room: c.room,
        capacity: c.capacity,
        enrolled: c._count.registrations,
        checkedIn,
        leaderName,
      };
    }),
  );

  return NextResponse.json({ classes: withChecked });
}
