import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildMobileRosterRows,
  countCheckedInForClassroom,
  loadMobileClassAttendanceMeta,
  teacherClassroomWhere,
} from "@/lib/mobile-class-roster";
import {
  loadSeasonOr404,
  requireClassRosterRole,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";

type RouteParams = { params: Promise<{ seasonId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireClassRosterRole(auth);
  if (denied) return denied;

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const campDateParam = req.nextUrl.searchParams.get("campDate");
  const attendance = await loadMobileClassAttendanceMeta(seasonId, campDateParam);
  const campDate = attendance?.campDate ?? "";
  const multiDay = attendance?.multiDayCheckInEnabled ?? season.multiDayCheckInEnabled;

  const classrooms = await prisma.classroom.findMany({
    where: {
      seasonId,
      isActive: true,
      ...(auth.role === "TEACHER" ? teacherClassroomWhere(auth.userId) : {}),
    },
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
      const checkedIn = await countCheckedInForClassroom({
        seasonId,
        classroomId: c.id,
        multiDayCheckInEnabled: multiDay,
        campDate,
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

  return NextResponse.json({ classes: withChecked, attendance });
}
