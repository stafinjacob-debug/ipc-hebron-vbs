import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSeasonAttendanceContext, resolveCheckedInMap } from "@/lib/attendance";
import { campDateKeyToUtcDate } from "@/lib/camp-date";
import { teacherClassroomWhere } from "@/lib/mobile-class-roster";
import {
  assertSeasonAccess,
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { mergeRegistrationScopeWhere, staffClassroomFilter } from "@/lib/staff-access-scope";

type RouteParams = { params: Promise<{ seasonId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { seasonId } = await params;
  const access = await assertSeasonAccess(auth.userId, seasonId);
  if (!access.ok) return access.response;

  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const campDateParam = req.nextUrl.searchParams.get("campDate");
  const attendanceContext = await loadSeasonAttendanceContext(seasonId, campDateParam);
  const campDate = attendanceContext?.defaultCampDate ?? "";
  const multiDay =
    attendanceContext?.multiDayCheckInEnabled ?? season.multiDayCheckInEnabled;

  const regScope = mergeRegistrationScopeWhere(access.scope, {
    seasonId,
    status: { not: "CANCELLED" },
  });
  const classScope = {
    seasonId,
    isActive: true,
    ...staffClassroomFilter(access.scope),
    ...(auth.role === "TEACHER" ? teacherClassroomWhere(auth.userId) : {}),
  };

  const [allRegs, classrooms, alertRegs] = await Promise.all([
    prisma.registration.findMany({
      where: regScope,
      select: { id: true },
    }),
    prisma.classroom.findMany({
      where: classScope,
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        room: true,
        registrations: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true },
        },
      },
    }),
    prisma.registration.count({
      where: {
        ...regScope,
        child: {
          allergiesNotes: { not: null },
          NOT: { allergiesNotes: "" },
        },
      },
    }),
  ]);

  const allIds = allRegs.map((r) => r.id);
  const checkedMap = await resolveCheckedInMap(allIds, campDate, multiDay);
  let checkedIn = 0;
  for (const id of allIds) {
    if (checkedMap.get(id)) checkedIn += 1;
  }
  const totalRegs = allIds.length;
  const expected = Math.max(0, totalRegs - checkedIn);

  const classSummaries = await Promise.all(
    classrooms.map(async (c) => {
      const ids = c.registrations.map((r) => r.id);
      const classCheckedMap = await resolveCheckedInMap(ids, campDate, multiDay);
      let classCheckedIn = 0;
      for (const id of ids) {
        if (classCheckedMap.get(id)) classCheckedIn += 1;
      }
      const enrolled = ids.length;
      return {
        classId: c.id,
        className: c.name,
        room: c.room,
        enrolled,
        checkedIn: classCheckedIn,
        expected: Math.max(0, enrolled - classCheckedIn),
      };
    }),
  );

  const campDateLabel =
    attendanceContext?.campDates.find((d) => d.key === campDate)?.label ?? "Today";

  let recentCheckIns: Array<{
    registrationId: string;
    studentName: string;
    className: string | null;
    checkedInAt: string | null;
  }>;

  if (multiDay && campDate) {
    const campDateUtc = campDateKeyToUtcDate(campDate);
    const dayRows = await prisma.registrationAttendanceDay.findMany({
      where: {
        campDate: campDateUtc,
        checkedInAt: { not: null },
        registration: regScope,
      },
      orderBy: { checkedInAt: "desc" },
      take: 8,
      include: {
        registration: {
          include: {
            child: { select: { firstName: true, lastName: true } },
            classroom: { select: { name: true } },
          },
        },
      },
    });
    recentCheckIns = dayRows.map((d) => ({
      registrationId: d.registrationId,
      studentName: `${d.registration.child.firstName} ${d.registration.child.lastName}`,
      className: d.registration.classroom?.name ?? null,
      checkedInAt: d.checkedInAt?.toISOString() ?? null,
    }));
  } else {
    const recent = await prisma.registration.findMany({
      where: { ...regScope, checkedInAt: { not: null } },
      orderBy: { checkedInAt: "desc" },
      take: 8,
      include: {
        child: { select: { firstName: true, lastName: true } },
        classroom: { select: { name: true } },
      },
    });
    recentCheckIns = recent.map((r) => ({
      registrationId: r.id,
      studentName: `${r.child.firstName} ${r.child.lastName}`,
      className: r.classroom?.name ?? null,
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
    }));
  }

  return NextResponse.json({
    season: {
      id: season.id,
      name: season.name,
      year: season.year,
      isActive: season.isActive,
    },
    attendance: attendanceContext
      ? {
          campDate,
          todayCampDate: attendanceContext.todayCampDate,
          multiDayCheckInEnabled: multiDay,
          campDateLabel,
          campDates: attendanceContext.campDates.map((d) => ({
            key: d.key,
            label: d.label,
          })),
        }
      : null,
    kpis: {
      checkedIn,
      expected,
      remainingArrivals: expected,
      classesActive: classSummaries.length,
      studentsWithAlerts: alertRegs,
    },
    classSummaries,
    recentCheckIns,
  });
}
