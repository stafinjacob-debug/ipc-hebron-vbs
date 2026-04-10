import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { canUseCheckInActions } from "@/lib/permissions";

type RouteParams = { params: Promise<{ seasonId: string; classId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canUseCheckInActions(auth.role)) {
    return jsonError(403, "Classes are not available for your role");
  }

  const { seasonId, classId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

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

  const roster = registrations.map((r) => {
    const notes = r.child.allergiesNotes?.trim();
    const status: "expected" | "checked_in" = r.checkedInAt
      ? "checked_in"
      : "expected";
    return {
      registrationId: r.id,
      studentName: `${r.child.firstName} ${r.child.lastName}`,
      hasMedicalAlert: Boolean(notes),
      checkedIn: !!r.checkedInAt,
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
      status,
    };
  });

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
  });
}
