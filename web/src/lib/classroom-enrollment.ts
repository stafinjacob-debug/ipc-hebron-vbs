import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { SEAT_COUNT_STATUSES } from "@/lib/class-assignment";

export type ClassroomEnrollmentCounts = {
  seated: number;
  waitlisted: number;
};

export async function getEnrollmentCountsByClassroom(
  seasonId: string,
): Promise<Map<string, ClassroomEnrollmentCounts>> {
  const [seatedRows, waitRows] = await Promise.all([
    prisma.registration.groupBy({
      by: ["classroomId"],
      where: {
        seasonId,
        classroomId: { not: null },
        status: { in: [...SEAT_COUNT_STATUSES] },
      },
      _count: { _all: true },
    }),
    prisma.registration.groupBy({
      by: ["classroomId"],
      where: {
        seasonId,
        classroomId: { not: null },
        status: "WAITLIST",
      },
      _count: { _all: true },
    }),
  ]);

  const map = new Map<string, ClassroomEnrollmentCounts>();
  for (const row of seatedRows) {
    if (row.classroomId)
      map.set(row.classroomId, {
        seated: row._count._all,
        waitlisted: 0,
      });
  }
  for (const row of waitRows) {
    if (!row.classroomId) continue;
    const cur = map.get(row.classroomId) ?? { seated: 0, waitlisted: 0 };
    cur.waitlisted = row._count._all;
    map.set(row.classroomId, cur);
  }
  return map;
}

export function classroomWhereForTeacher(userId: string): Prisma.ClassroomWhereInput {
  return {
    OR: [
      { leaderAssignments: { some: { userId } } },
      { userClassroomScopes: { some: { userId } } },
    ],
  };
}
