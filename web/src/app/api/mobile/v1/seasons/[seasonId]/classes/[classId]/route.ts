import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserViewClassroom } from "@/lib/classroom-access";
import {
  buildMobileRosterRows,
  loadMobileClassAttendanceMeta,
} from "@/lib/mobile-class-roster";
import {
  loadSeasonOr404,
  requireClassRosterRole,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";

type RouteParams = { params: Promise<{ seasonId: string; classId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireClassRosterRole(auth);
  if (denied) return denied;

  const { seasonId, classId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const allowed = await canUserViewClassroom(auth.userId, auth.role, classId);
  if (!allowed) return jsonError(403, "You do not have access to this class");

  const campDateParam = req.nextUrl.searchParams.get("campDate");
  const attendance = await loadMobileClassAttendanceMeta(seasonId, campDateParam);
  const campDate = attendance?.campDate ?? "";
  const multiDay = attendance?.multiDayCheckInEnabled ?? season.multiDayCheckInEnabled;

  const classroom = await prisma.classroom.findFirst({
    where: { id: classId, seasonId },
    include: {
      leaderAssignments: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });
  if (!classroom) return jsonError(404, "Class not found");

  const registrations = await prisma.registration.findMany({
    where: {
      seasonId,
      classroomId: classId,
      status: { not: "CANCELLED" },
    },
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
    include: {
      child: {
        select: {
          firstName: true,
          lastName: true,
          allergiesNotes: true,
        },
      },
    },
  });

  const roster = await buildMobileRosterRows(registrations, seasonId, multiDay, campDate);

  const leaders = classroom.leaderAssignments.map((a) => ({
    userId: a.userId,
    name: a.user.name ?? a.user.email,
    role: a.role,
  }));

  return NextResponse.json({
    class: {
      id: classroom.id,
      name: classroom.name,
      ageMin: classroom.ageMin,
      ageMax: classroom.ageMax,
      gradeLabel: classroom.gradeLabel,
      room: classroom.room,
      capacity: classroom.capacity,
    },
    leaders,
    roster,
    counts: {
      enrolled: roster.length,
      checkedIn: roster.filter((x) => x.checkedIn).length,
    },
    attendance,
  });
}
