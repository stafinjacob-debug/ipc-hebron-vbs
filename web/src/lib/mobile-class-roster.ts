import type { Prisma } from "@/generated/prisma";
import { loadSeasonAttendanceContext, resolveCheckedInMap } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

export type MobileRosterRow = {
  registrationId: string;
  studentName: string;
  hasMedicalAlert: boolean;
  checkedIn: boolean;
  checkedInAt: string | null;
  status: "expected" | "checked_in";
};

export type MobileClassAttendanceMeta = {
  campDate: string;
  todayCampDate: string;
  multiDayCheckInEnabled: boolean;
  campDates: Array<{ key: string; label: string }>;
};

export async function loadMobileClassAttendanceMeta(
  seasonId: string,
  campDateParam: string | null,
): Promise<MobileClassAttendanceMeta | null> {
  const ctx = await loadSeasonAttendanceContext(seasonId, campDateParam);
  if (!ctx) return null;
  return {
    campDate: ctx.defaultCampDate,
    todayCampDate: ctx.todayCampDate,
    multiDayCheckInEnabled: ctx.multiDayCheckInEnabled,
    campDates: ctx.campDates.map((d) => ({ key: d.key, label: d.label })),
  };
}

export async function buildMobileRosterRows(
  registrations: Array<{
    id: string;
    checkedInAt: Date | null;
    child: { firstName: string; lastName: string; allergiesNotes: string | null };
  }>,
  seasonId: string,
  multiDayCheckInEnabled: boolean,
  campDate: string,
): Promise<MobileRosterRow[]> {
  const ids = registrations.map((r) => r.id);
  const checkedMap = await resolveCheckedInMap(ids, campDate, multiDayCheckInEnabled);

  return registrations.map((r) => {
    const notes = r.child.allergiesNotes?.trim();
    const checkedIn = checkedMap.get(r.id) ?? false;
    return {
      registrationId: r.id,
      studentName: `${r.child.firstName} ${r.child.lastName}`,
      hasMedicalAlert: Boolean(notes),
      checkedIn,
      checkedInAt: checkedIn ? (r.checkedInAt?.toISOString() ?? null) : null,
      status: checkedIn ? "checked_in" : "expected",
    };
  });
}

export async function countCheckedInForClassroom(args: {
  seasonId: string;
  classroomId: string;
  multiDayCheckInEnabled: boolean;
  campDate: string;
}): Promise<number> {
  const registrations = await prisma.registration.findMany({
    where: {
      seasonId: args.seasonId,
      classroomId: args.classroomId,
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });
  const checkedMap = await resolveCheckedInMap(
    registrations.map((r) => r.id),
    args.campDate,
    args.multiDayCheckInEnabled,
  );
  let count = 0;
  for (const id of checkedMap.keys()) {
    if (checkedMap.get(id)) count += 1;
  }
  return count;
}

export function teacherClassroomWhere(userId: string): Prisma.ClassroomWhereInput {
  return {
    OR: [
      { leaderAssignments: { some: { userId } } },
      { userClassroomScopes: { some: { userId } } },
    ],
  };
}
