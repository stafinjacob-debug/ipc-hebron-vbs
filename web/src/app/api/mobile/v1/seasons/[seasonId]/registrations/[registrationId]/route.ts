import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadSeasonAttendanceContext, resolveCheckedInMap } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import {
  assertSeasonAccess,
  loadSeasonOr404,
  registrationDeniedByScope,
  requireClassRosterRole,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { canUserViewClassroom } from "@/lib/classroom-access";

type RouteParams = {
  params: Promise<{ seasonId: string; registrationId: string }>;
};

function registrationInclude() {
  return {
    child: {
      include: {
        guardian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    },
    classroom: { select: { id: true, name: true, room: true } },
    formSubmission: { select: { registrationCode: true } },
  } as const;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireClassRosterRole(auth);
  if (denied) return denied;

  const { seasonId, registrationId } = await params;
  const access = await assertSeasonAccess(auth.userId, seasonId);
  if (!access.ok) return access.response;

  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const campDateParam = req.nextUrl.searchParams.get("campDate");
  const attendanceContext = await loadSeasonAttendanceContext(seasonId, campDateParam);
  const campDate = attendanceContext?.defaultCampDate ?? "";

  const r = await prisma.registration.findFirst({
    where: { id: registrationId, seasonId },
    include: registrationInclude(),
  });
  if (!r) return jsonError(404, "Registration not found");

  const scopeDenied = registrationDeniedByScope(access.scope, {
    seasonId: r.seasonId,
    classroomId: r.classroomId,
  });
  if (scopeDenied) return scopeDenied;

  if (auth.role === "TEACHER" && r.classroomId) {
    const allowed = await canUserViewClassroom(auth.userId, auth.role, r.classroomId);
    if (!allowed) return jsonError(403, "You do not have access to this student");
  } else if (auth.role === "TEACHER" && !r.classroomId) {
    return jsonError(403, "You do not have access to this student");
  }

  const checkedInMap = await resolveCheckedInMap(
    [r.id],
    campDate,
    season.multiDayCheckInEnabled,
  );
  const checkedIn = checkedInMap.get(r.id) ?? false;

  const now = new Date();
  const dob = r.child.dateOfBirth;
  const ageYears = Math.floor(
    (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  const allergies = r.child.allergiesNotes?.trim();

  const siblings = await prisma.registration.findMany({
    where: {
      seasonId,
      child: { guardianId: r.child.guardianId },
      status: { not: "CANCELLED" },
      NOT: { id: r.id },
    },
    include: {
      child: { select: { firstName: true, lastName: true } },
      classroom: { select: { name: true } },
    },
  });

  return NextResponse.json({
    registration: {
      id: r.id,
      status: r.status,
      checkedIn,
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
      registrationCode:
        r.registrationNumber ??
        r.formSubmission?.registrationCode ??
        null,
      notes: r.notes,
    },
    student: {
      firstName: r.child.firstName,
      lastName: r.child.lastName,
      dateOfBirth: r.child.dateOfBirth.toISOString(),
      ageYears,
      allergiesNotes: allergies || null,
      hasMedicalAlert: Boolean(allergies),
    },
    guardian: r.child.guardian,
    class: r.classroom
      ? {
          id: r.classroom.id,
          name: r.classroom.name,
          room: r.classroom.room,
        }
      : null,
    siblings: siblings.map((s) => ({
      registrationId: s.id,
      name: `${s.child.firstName} ${s.child.lastName}`,
      className: s.classroom?.name ?? null,
    })),
  });
}
