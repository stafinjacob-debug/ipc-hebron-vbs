import { SEAT_COUNT_STATUSES } from "@/lib/class-assignment";
import { getEventContext, type EventPhase } from "@/lib/event-phase";
import { prisma } from "@/lib/prisma";

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const activeRegStatuses = ["PENDING", "CONFIRMED", "WAITLIST"] as const;

export type DashboardSnapshot = {
  activeSeason: {
    id: string;
    name: string;
    year: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    publicRegistrationOpen: boolean;
  } | null;
  kpis: {
    activeSeasonsCount: number;
    registrationTotal: number;
    registrationsThisWeek: number;
    studentProfilesCount: number;
    classesActive: number;
    classesNearFull: number;
    classesFull: number;
    checkedInToday: number;
    awaitingCheckIn: number;
    pendingAssignments: number;
    volunteerCount: number;
    teachersUnassigned: number;
  };
  capacityAlerts: Array<{
    classroomId: string;
    name: string;
    seasonName: string;
    enrolled: number;
    capacity: number;
    pct: number;
  }>;
  topCheckInClassesToday: Array<{
    classroomId: string;
    name: string;
    count: number;
  }>;
  recentRegistrations: Array<{
    id: string;
    childName: string;
    seasonName: string;
    classroomName: string | null;
    registeredAt: Date;
    status: string;
  }>;
  unassignedSample: Array<{
    id: string;
    childName: string;
    seasonName: string;
    status: string;
  }>;
  eventPhase: EventPhase;
  daysUntilStart: number | null;
  eventDayLabel: string | null;
  totalSeatCapacity: number;
  classAttendanceToday: Array<{
    classroomId: string;
    name: string;
    enrolled: number;
    checkedInToday: number;
    pctCheckedIn: number;
  }>;
  classesNoCheckInToday: Array<{
    classroomId: string;
    name: string;
    enrolled: number;
  }>;
};

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const activeSeason = await prisma.vbsSeason.findFirst({
    where: { isActive: true },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
  });

  const seasonId = activeSeason?.id ?? null;
  const dayStart = startOfLocalDay();
  const dayEnd = endOfLocalDay();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    activeSeasonsCount,
    registrationTotal,
    registrationsThisWeek,
    studentProfilesCount,
    checkedInToday,
    pendingAssignments,
    awaitingCheckIn,
    classroomsWithCounts,
    recentRegs,
    volunteerCount,
    teachersUnassigned,
    unassignedRegs,
  ] = await Promise.all([
    prisma.vbsSeason.count({ where: { isActive: true } }),
    seasonId
      ? prisma.registration.count({ where: { seasonId } })
      : prisma.registration.count(),
    seasonId
      ? prisma.registration.count({
          where: { seasonId, registeredAt: { gte: weekAgo } },
        })
      : prisma.registration.count({ where: { registeredAt: { gte: weekAgo } } }),
    prisma.child.count(),
    seasonId
      ? prisma.registration.count({
          where: {
            seasonId,
            checkedInAt: { gte: dayStart, lte: dayEnd },
          },
        })
      : prisma.registration.count({
          where: {
            checkedInAt: { gte: dayStart, lte: dayEnd },
          },
        }),
    seasonId
      ? prisma.registration.count({
          where: {
            seasonId,
            classroomId: null,
            status: { in: [...activeRegStatuses] },
          },
        })
      : prisma.registration.count({
          where: {
            classroomId: null,
            status: { in: [...activeRegStatuses] },
          },
        }),
    seasonId
      ? prisma.registration.count({
          where: {
            seasonId,
            status: { in: [...activeRegStatuses] },
            checkedInAt: null,
          },
        })
      : prisma.registration.count({
          where: {
            status: { in: [...activeRegStatuses] },
            checkedInAt: null,
          },
        }),
    seasonId
      ? prisma.classroom.findMany({
          where: { seasonId },
          include: {
            season: { select: { name: true } },
            _count: {
              select: {
                registrations: {
                  where: { status: { in: [...SEAT_COUNT_STATUSES] } },
                },
              },
            },
          },
        })
      : prisma.classroom.findMany({
          where: { season: { isActive: true } },
          include: {
            season: { select: { name: true } },
            _count: {
              select: {
                registrations: {
                  where: { status: { in: [...SEAT_COUNT_STATUSES] } },
                },
              },
            },
          },
        }),
    seasonId
      ? prisma.registration.findMany({
          where: { seasonId },
          orderBy: { registeredAt: "desc" },
          take: 8,
          include: {
            child: true,
            classroom: true,
            season: { select: { name: true } },
          },
        })
      : prisma.registration.findMany({
          orderBy: { registeredAt: "desc" },
          take: 8,
          include: {
            child: true,
            classroom: true,
            season: { select: { name: true } },
          },
        }),
    prisma.volunteerProfile.count(),
    seasonId
      ? prisma.volunteerAssignment.count({
          where: { seasonId, classroomId: null },
        })
      : prisma.volunteerAssignment.count({
          where: { classroomId: null, season: { isActive: true } },
        }),
    seasonId
      ? prisma.registration.findMany({
          where: {
            seasonId,
            classroomId: null,
            status: { in: [...activeRegStatuses] },
          },
          take: 6,
          orderBy: { registeredAt: "desc" },
          include: {
            child: true,
            season: { select: { name: true } },
          },
        })
      : prisma.registration.findMany({
          where: {
            classroomId: null,
            status: { in: [...activeRegStatuses] },
          },
          take: 6,
          orderBy: { registeredAt: "desc" },
          include: {
            child: true,
            season: { select: { name: true } },
          },
        }),
  ]);

  let classesNearFull = 0;
  let classesFull = 0;
  const capacityAlerts: DashboardSnapshot["capacityAlerts"] = [];

  for (const c of classroomsWithCounts) {
    const enrolled = c._count.registrations;
    const capacity = c.capacity;
    const pct = capacity > 0 ? enrolled / capacity : 0;
    if (capacity > 0 && enrolled >= capacity) classesFull++;
    else if (pct >= 0.8) classesNearFull++;
    if (pct >= 0.8 || (capacity > 0 && enrolled >= capacity)) {
      capacityAlerts.push({
        classroomId: c.id,
        name: c.name,
        seasonName: c.season.name,
        enrolled,
        capacity,
        pct,
      });
    }
  }

  capacityAlerts.sort((a, b) => b.pct - a.pct);

  const groupCheckIns = seasonId
    ? await prisma.registration.groupBy({
        by: ["classroomId"],
        where: {
          seasonId,
          checkedInAt: { gte: dayStart, lte: dayEnd },
          classroomId: { not: null },
        },
        _count: { _all: true },
      })
    : await prisma.registration.groupBy({
        by: ["classroomId"],
        where: {
          checkedInAt: { gte: dayStart, lte: dayEnd },
          classroomId: { not: null },
        },
        _count: { _all: true },
      });

  const classIds = groupCheckIns
    .map((g) => g.classroomId)
    .filter((id): id is string => id != null);
  const classNames =
    classIds.length > 0
      ? await prisma.classroom.findMany({
          where: { id: { in: classIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameById = new Map(classNames.map((c) => [c.id, c.name]));

  const topCheckInClassesToday = groupCheckIns
    .map((g) => ({
      classroomId: g.classroomId!,
      name: nameById.get(g.classroomId!) ?? "Class",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const { phase: eventPhase, daysUntilStart, eventDayLabel } = getEventContext(
    new Date(),
    activeSeason?.startDate ?? null,
    activeSeason?.endDate ?? null,
  );

  const totalSeatCapacity = classroomsWithCounts.reduce((sum, c) => sum + c.capacity, 0);

  const checkInByClassId = new Map(
    groupCheckIns.map((g) => [g.classroomId as string, g._count._all]),
  );

  const classAttendanceToday = classroomsWithCounts.map((c) => {
    const enrolled = c._count.registrations;
    const checkedInToday = checkInByClassId.get(c.id) ?? 0;
    const pctCheckedIn = enrolled > 0 ? Math.round((checkedInToday / enrolled) * 100) : 0;
    return {
      classroomId: c.id,
      name: c.name,
      enrolled,
      checkedInToday,
      pctCheckedIn,
    };
  });

  const classesNoCheckInToday = classAttendanceToday
    .filter((c) => c.enrolled > 0 && c.checkedInToday === 0)
    .map(({ classroomId, name, enrolled }) => ({ classroomId, name, enrolled }));

  const classAttendanceSorted = [...classAttendanceToday].sort(
    (a, b) => a.pctCheckedIn - b.pctCheckedIn || b.enrolled - a.enrolled,
  );

  return {
    activeSeason,
    kpis: {
      activeSeasonsCount,
      registrationTotal,
      registrationsThisWeek,
      studentProfilesCount,
      classesActive: classroomsWithCounts.length,
      classesNearFull,
      classesFull,
      checkedInToday,
      awaitingCheckIn,
      pendingAssignments,
      volunteerCount,
      teachersUnassigned,
    },
    capacityAlerts: capacityAlerts.slice(0, 8),
    topCheckInClassesToday,
    recentRegistrations: recentRegs.map((r) => ({
      id: r.id,
      childName: `${r.child.firstName} ${r.child.lastName}`,
      seasonName: r.season.name,
      classroomName: r.classroom?.name ?? null,
      registeredAt: r.registeredAt,
      status: r.status,
    })),
    unassignedSample: unassignedRegs.map((r) => ({
      id: r.id,
      childName: `${r.child.firstName} ${r.child.lastName}`,
      seasonName: r.season.name,
      status: r.status,
    })),
    eventPhase,
    daysUntilStart,
    eventDayLabel,
    totalSeatCapacity,
    classAttendanceToday: classAttendanceSorted.slice(0, 12),
    classesNoCheckInToday: classesNoCheckInToday.slice(0, 8),
  };
}
