export * from "./class-assignment-shared";

import type { Prisma, PrismaClient, RegistrationStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  SEAT_COUNT_STATUSES,
  ageForClassroomRule,
  type AutoAssignResult,
  type ClassroomForAutoAssign,
} from "./class-assignment-shared";

export async function countSeatedRegistrations(
  tx: Prisma.TransactionClient,
  classroomId: string,
  excludeRegistrationId?: string,
): Promise<number> {
  return tx.registration.count({
    where: {
      classroomId,
      status: { in: [...SEAT_COUNT_STATUSES] },
      ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
    },
  });
}

export async function countWaitlistedInClass(
  tx: Prisma.TransactionClient,
  classroomId: string,
): Promise<number> {
  return tx.registration.count({
    where: { classroomId, status: "WAITLIST" },
  });
}

/**
 * Pick first matching class by sortOrder and assign seat or waitlist per class rules.
 * Does not write to DB — caller updates registration.
 */
export async function resolveAutoClassAssignment(
  tx: Prisma.TransactionClient,
  params: {
    childDob: Date;
    registeredAt: Date;
    seasonStartDate: Date;
    currentStatus: RegistrationStatus;
    classrooms: ClassroomForAutoAssign[];
  },
): Promise<AutoAssignResult> {
  const { childDob, registeredAt, seasonStartDate, currentStatus, classrooms } = params;

  const sorted = [...classrooms].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  let lastMatchedAge: number | null = null;

  for (const c of sorted) {
    if (!c.isActive) continue;
    if (c.intakeStatus !== "OPEN") continue;

    const age = ageForClassroomRule(childDob, c.ageRule, registeredAt, seasonStartDate);
    if (age < c.ageMin || age > c.ageMax) continue;

    lastMatchedAge = age;

    const seated = await countSeatedRegistrations(tx, c.id);
    const cap = c.capacity;

    if (cap <= 0 || seated < cap) {
      return {
        classroomId: c.id,
        matchedAge: age,
      };
    }

    if (c.waitlistEnabled) {
      const wl: AutoAssignResult = {
        classroomId: c.id,
        matchedAge: age,
      };
      if (currentStatus === "PENDING" || currentStatus === "DRAFT") {
        wl.nextStatus = "WAITLIST";
      }
      return wl;
    }

    // Full with no class waitlist — try another matching class (overflow).
    continue;
  }

  if (lastMatchedAge != null) {
    return {
      classroomId: null,
      matchedAge: lastMatchedAge,
      note:
        "Auto: every age-matching class is full (no waitlist or overflow class available).",
    };
  }

  return {
    classroomId: null,
    matchedAge: null,
    note: "Auto: no active class matched this child’s age for this season.",
  };
}

export async function fetchClassroomsForAutoAssign(
  db: PrismaClient | Prisma.TransactionClient,
  seasonId: string,
): Promise<ClassroomForAutoAssign[]> {
  return db.classroom.findMany({
    where: { seasonId },
    select: {
      id: true,
      name: true,
      ageMin: true,
      ageMax: true,
      ageRule: true,
      capacity: true,
      waitlistEnabled: true,
      intakeStatus: true,
      isActive: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function applyAutoAssignmentToRegistration(
  tx: Prisma.TransactionClient,
  params: {
    registrationId: string;
    result: AutoAssignResult;
    existingNotes: string | null;
  },
): Promise<void> {
  const { registrationId, result, existingNotes } = params;
  const data: Prisma.RegistrationUpdateInput = {
    classAssignmentMethod: "AUTO",
    classMatchedAtAge: result.matchedAge,
  };
  if (result.classroomId) {
    data.classroom = { connect: { id: result.classroomId } };
  }
  if (result.nextStatus) {
    data.status = result.nextStatus;
  }
  if (result.note) {
    const prefix = existingNotes?.trim() ? `${existingNotes.trim()} · ` : "";
    data.notes = `${prefix}${result.note}`;
  }
  await tx.registration.update({
    where: { id: registrationId },
    data,
  });
}

/** Assign a class when none is set (e.g. after staff approval). */
export async function tryAutoAssignRegistration(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { child: true, season: true },
  });
  if (!reg?.child || reg.classroomId != null) return;
  if (reg.status === "CANCELLED") return;

  await prisma.$transaction(async (tx) => {
    const classrooms = await fetchClassroomsForAutoAssign(tx, reg.seasonId);
    const result = await resolveAutoClassAssignment(tx, {
      childDob: reg.child.dateOfBirth,
      registeredAt: reg.registeredAt,
      seasonStartDate: reg.season.startDate,
      currentStatus: reg.status,
      classrooms,
    });
    await applyAutoAssignmentToRegistration(tx, {
      registrationId,
      result,
      existingNotes: reg.notes,
    });
  });
}
