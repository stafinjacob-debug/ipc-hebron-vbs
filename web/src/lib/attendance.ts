import { prisma } from "@/lib/prisma";
import {
  CHECK_IN_BLOCK_REGISTRATION_SELECT,
  evaluateCheckInBlock,
  parseCheckInBlockSettings,
  type CheckInBlockRegistrationRow,
} from "@/lib/check-in-block";
import {
  campDateKeyToUtcDate,
  campDateLocalBounds,
  isPastCampDate,
  isTodayCampDate,
  localTodayCampDateKey,
  resolveCampDateKey,
  type CampDateOption,
  buildCampDateOptions,
} from "@/lib/camp-date";

export type SeasonAttendanceContext = {
  multiDayCheckInEnabled: boolean;
  campDates: CampDateOption[];
  todayCampDate: string;
  defaultCampDate: string;
};

export function isCurrentlyCheckedIn(
  checkedInAt: Date | null | undefined,
  checkedOutAt: Date | null | undefined,
): boolean {
  return Boolean(checkedInAt && !checkedOutAt);
}

export async function loadSeasonAttendanceContext(
  seasonId: string,
  requestedCampDate?: string | null,
): Promise<SeasonAttendanceContext | null> {
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: {
      multiDayCheckInEnabled: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!season) return null;

  const campDates = buildCampDateOptions(season.startDate, season.endDate);
  const resolved = resolveCampDateKey(season.startDate, season.endDate, requestedCampDate);

  return {
    multiDayCheckInEnabled: season.multiDayCheckInEnabled,
    campDates,
    todayCampDate: localTodayCampDateKey(),
    defaultCampDate: resolved.key,
  };
}

export async function resolveCheckedInMap(
  registrationIds: string[],
  campDateKey: string,
  multiDayEnabled: boolean,
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (registrationIds.length === 0) return out;

  if (!multiDayEnabled) {
    const { start, end } = campDateLocalBounds(campDateKey);
    const rows = await prisma.registration.findMany({
      where: { id: { in: registrationIds } },
      select: { id: true, checkedInAt: true },
    });
    for (const row of rows) {
      const at = row.checkedInAt;
      const onDay = Boolean(at && at >= start && at <= end);
      out.set(row.id, onDay);
    }
    return out;
  }

  const campDate = campDateKeyToUtcDate(campDateKey);
  const rows = await prisma.registrationAttendanceDay.findMany({
    where: {
      registrationId: { in: registrationIds },
      campDate,
    },
    select: { registrationId: true, checkedInAt: true, checkedOutAt: true },
  });
  const rowMap = new Map(rows.map((r) => [r.registrationId, r]));

  for (const id of registrationIds) {
    const day = rowMap.get(id);
    out.set(id, isCurrentlyCheckedIn(day?.checkedInAt, day?.checkedOutAt));
  }
  return out;
}

export type SetAttendanceResult =
  | {
      ok: true;
      checkedIn: boolean;
      checkedInAt: string | null;
      alreadyCheckedIn?: boolean;
      alreadyCheckedOut?: boolean;
    }
  | { ok: false; message: string };

export async function setRegistrationAttendance(input: {
  registrationId: string;
  seasonId: string;
  checkedIn: boolean;
  campDateKey?: string | null;
  actorUserId?: string | null;
  undoPin?: string | null;
  /** When checking out via dismissal pickup, skip the undo security code. */
  dismissalCheckout?: boolean;
}): Promise<SetAttendanceResult> {
  const season = await prisma.vbsSeason.findUnique({
    where: { id: input.seasonId },
    select: {
      id: true,
      name: true,
      multiDayCheckInEnabled: true,
      startDate: true,
      endDate: true,
      checkInBlockRulesJson: true,
      checkInUndoPin: true,
    },
  });
  if (!season) return { ok: false, message: "Season not found." };

  const existing = await prisma.registration.findFirst({
    where: { id: input.registrationId, seasonId: input.seasonId, status: { not: "CANCELLED" } },
    select: { id: true, checkedInAt: true },
  });
  if (!existing) return { ok: false, message: "Registration not found." };

  if (!input.checkedIn && season.checkInUndoPin && !input.dismissalCheckout) {
    const provided = (input.undoPin ?? "").trim();
    if (!provided) {
      return { ok: false, message: "Security code is required to undo check-in." };
    }
    if (provided !== season.checkInUndoPin) {
      return { ok: false, message: "Incorrect security code." };
    }
  }

  if (input.checkedIn) {
    const blockSettings = parseCheckInBlockSettings(season.checkInBlockRulesJson);
    if (blockSettings.enabled) {
      const row = await prisma.registration.findUnique({
        where: { id: input.registrationId },
        select: CHECK_IN_BLOCK_REGISTRATION_SELECT,
      });
      if (row) {
        const block = evaluateCheckInBlock(
          row as CheckInBlockRegistrationRow,
          season.name,
          blockSettings,
        );
        if (block.blocked) {
          return { ok: false, message: block.message };
        }
      }
    }
  }

  if (!season.multiDayCheckInEnabled) {
    if (input.checkedIn) {
      if (existing.checkedInAt) {
        return {
          ok: true,
          checkedIn: true,
          checkedInAt: existing.checkedInAt.toISOString(),
          alreadyCheckedIn: true,
        };
      }
      const updated = await prisma.registration.update({
        where: { id: input.registrationId },
        data: { checkedInAt: new Date() },
        select: { checkedInAt: true },
      });
      return {
        ok: true,
        checkedIn: true,
        checkedInAt: updated.checkedInAt?.toISOString() ?? null,
      };
    }

    if (!existing.checkedInAt) {
      return { ok: true, checkedIn: false, checkedInAt: null, alreadyCheckedOut: true };
    }
    await prisma.registration.update({
      where: { id: input.registrationId },
      data: { checkedInAt: null },
    });
    return { ok: true, checkedIn: false, checkedInAt: null };
  }

  const resolved = resolveCampDateKey(season.startDate, season.endDate, input.campDateKey);
  if (resolved.error && !resolved.key) {
    return { ok: false, message: resolved.error };
  }
  const campDateKey = resolved.key;

  if (isPastCampDate(campDateKey)) {
    return { ok: false, message: "Check-in cannot be changed for a past camp day." };
  }

  const campDate = campDateKeyToUtcDate(campDateKey);
  const now = new Date();
  const day = await prisma.registrationAttendanceDay.findUnique({
    where: {
      registrationId_campDate: {
        registrationId: input.registrationId,
        campDate,
      },
    },
    select: { id: true, checkedInAt: true, checkedOutAt: true },
  });

  if (input.checkedIn) {
    if (isCurrentlyCheckedIn(day?.checkedInAt, day?.checkedOutAt)) {
      return {
        ok: true,
        checkedIn: true,
        checkedInAt: day!.checkedInAt!.toISOString(),
        alreadyCheckedIn: true,
      };
    }

    const updatedDay = await prisma.registrationAttendanceDay.upsert({
      where: {
        registrationId_campDate: {
          registrationId: input.registrationId,
          campDate,
        },
      },
      create: {
        registrationId: input.registrationId,
        campDate,
        checkedInAt: now,
        checkedOutAt: null,
      },
      update: {
        checkedInAt: now,
        checkedOutAt: null,
      },
      select: { checkedInAt: true },
    });

    if (isTodayCampDate(campDateKey)) {
      await prisma.registration.update({
        where: { id: input.registrationId },
        data: { checkedInAt: now },
      });
    }

    return {
      ok: true,
      checkedIn: true,
      checkedInAt: updatedDay.checkedInAt?.toISOString() ?? null,
    };
  }

  if (!isCurrentlyCheckedIn(day?.checkedInAt, day?.checkedOutAt)) {
    return { ok: true, checkedIn: false, checkedInAt: null, alreadyCheckedOut: true };
  }

  await prisma.registrationAttendanceDay.update({
    where: { id: day!.id },
    data: { checkedOutAt: now },
  });

  if (isTodayCampDate(campDateKey)) {
    await prisma.registration.update({
      where: { id: input.registrationId },
      data: { checkedInAt: null },
    });
  }

  return { ok: true, checkedIn: false, checkedInAt: null };
}

/** Count students who checked in on a camp day, grouped by classroom. */
export async function countCheckInsForCampDate(
  seasonId: string,
  campDateKey: string,
  multiDayEnabled: boolean,
): Promise<{ total: number; byClassId: Map<string, number> }> {
  const byClassId = new Map<string, number>();

  if (multiDayEnabled) {
    const campDate = campDateKeyToUtcDate(campDateKey);
    const days = await prisma.registrationAttendanceDay.findMany({
      where: {
        campDate,
        checkedInAt: { not: null },
        checkedOutAt: null,
        registration: { seasonId, status: { not: "CANCELLED" } },
      },
      select: {
        registration: { select: { classroomId: true } },
      },
    });
    for (const day of days) {
      const classId = day.registration.classroomId;
      if (!classId) continue;
      byClassId.set(classId, (byClassId.get(classId) ?? 0) + 1);
    }
    return { total: days.length, byClassId };
  }

  const { start, end } = campDateLocalBounds(campDateKey);
  const rows = await prisma.registration.findMany({
    where: {
      seasonId,
      status: { not: "CANCELLED" },
      checkedInAt: { gte: start, lte: end },
    },
    select: { classroomId: true },
  });
  for (const row of rows) {
    if (!row.classroomId) continue;
    byClassId.set(row.classroomId, (byClassId.get(row.classroomId) ?? 0) + 1);
  }
  return { total: rows.length, byClassId };
}

export type AttendanceExportRow = {
  registrationId: string;
  registrationNumber: string | null;
  studentName: string;
  className: string | null;
  guardianName: string;
  guardianPhone: string | null;
  status: "Checked in" | "Checked out" | "Not checked in";
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export async function loadAttendanceExportRows(
  seasonId: string,
  campDateKey: string,
): Promise<AttendanceExportRow[]> {
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: { multiDayCheckInEnabled: true, startDate: true, endDate: true },
  });
  if (!season) return [];

  const resolved = resolveCampDateKey(season.startDate, season.endDate, campDateKey);
  const key = resolved.key;
  const campDate = campDateKeyToUtcDate(key);

  const registrations = await prisma.registration.findMany({
    where: { seasonId, status: { not: "CANCELLED" } },
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
    include: {
      child: { include: { guardian: true } },
      classroom: { select: { name: true } },
    },
  });

  let dayByRegistration = new Map<
    string,
    { checkedInAt: Date | null; checkedOutAt: Date | null }
  >();

  if (season.multiDayCheckInEnabled) {
    const days = await prisma.registrationAttendanceDay.findMany({
      where: {
        campDate,
        registrationId: { in: registrations.map((r) => r.id) },
      },
      select: { registrationId: true, checkedInAt: true, checkedOutAt: true },
    });
    dayByRegistration = new Map(days.map((d) => [d.registrationId, d]));
  }

  return registrations.map((r) => {
    const guardian = r.child.guardian;
    let checkedInAt: Date | null = null;
    let checkedOutAt: Date | null = null;
    let status: AttendanceExportRow["status"] = "Not checked in";

    if (season.multiDayCheckInEnabled) {
      const day = dayByRegistration.get(r.id);
      checkedInAt = day?.checkedInAt ?? null;
      checkedOutAt = day?.checkedOutAt ?? null;
    } else if (isTodayCampDate(key) && r.checkedInAt) {
      checkedInAt = r.checkedInAt;
    }

    if (isCurrentlyCheckedIn(checkedInAt, checkedOutAt)) {
      status = "Checked in";
    } else if (checkedInAt && checkedOutAt) {
      status = "Checked out";
    }

    return {
      registrationId: r.id,
      registrationNumber: r.registrationNumber,
      studentName: `${r.child.firstName} ${r.child.lastName}`.trim(),
      className: r.classroom?.name ?? null,
      guardianName: `${guardian.firstName} ${guardian.lastName}`.trim(),
      guardianPhone: guardian.phone,
      status,
      checkedInAt: checkedInAt?.toISOString() ?? null,
      checkedOutAt: checkedOutAt?.toISOString() ?? null,
    };
  });
}
