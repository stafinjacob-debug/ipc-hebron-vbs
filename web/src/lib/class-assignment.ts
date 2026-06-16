export * from "./class-assignment-shared";

import type { Prisma, PrismaClient, RegistrationStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  coerceJsonLeaf,
  customResponsesAsRecord,
  fieldValueMatchesAllowed,
  jsonToStringArray,
} from "@/lib/class-form-field-match";
import {
  SEAT_COUNT_STATUSES,
  ageForClassroomRule,
  birthDateInEligibilityRange,
  classroomUsesBirthDateRange,
  roundRobinGroupId,
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

function classroomMatchesFormFieldRules(
  c: ClassroomForAutoAssign,
  childFieldContext: Record<string, string | boolean | number | null>,
): boolean {
  const mKey = c.matchFormFieldKey?.trim() ?? "";
  const mVals = c.matchFormFieldValues ?? [];
  if (!mKey || mVals.length === 0) return true;
  return fieldValueMatchesAllowed(childFieldContext, mKey, mVals);
}

export function classroomMatchesEligibility(
  c: ClassroomForAutoAssign,
  childDob: Date,
  registeredAt: Date,
  seasonStartDate: Date,
  childFieldContext: Record<string, string | boolean | number | null>,
): { matches: boolean; matchedAge: number | null } {
  const matchedAge = ageForClassroomRule(
    childDob,
    c.ageRule,
    registeredAt,
    seasonStartDate,
  );

  if (classroomUsesBirthDateRange(c)) {
    if (
      !birthDateInEligibilityRange(
        childDob,
        c.birthDateMin!,
        c.birthDateMax!,
      )
    ) {
      return { matches: false, matchedAge };
    }
  } else if (c.useAgeRuleForAutoAssign) {
    if (matchedAge < c.ageMin || matchedAge > c.ageMax) {
      return { matches: false, matchedAge };
    }
  }

  if (!classroomMatchesFormFieldRules(c, childFieldContext)) {
    return { matches: false, matchedAge };
  }

  return { matches: true, matchedAge };
}

async function pickFromRoundRobinGroup(
  tx: Prisma.TransactionClient,
  candidates: ClassroomForAutoAssign[],
  currentStatus: RegistrationStatus,
  matchedAge: number | null,
): Promise<AutoAssignResult | null> {
  const withSeats = await Promise.all(
    candidates.map(async (c) => ({
      c,
      seated: await countSeatedRegistrations(tx, c.id),
    })),
  );

  withSeats.sort(
    (a, b) =>
      a.seated - b.seated ||
      a.c.sortOrder - b.c.sortOrder ||
      a.c.id.localeCompare(b.c.id),
  );

  for (const { c, seated } of withSeats) {
    const cap = c.capacity;
    if (cap <= 0 || seated < cap) {
      return { classroomId: c.id, matchedAge };
    }

    if (c.waitlistEnabled) {
      const wl: AutoAssignResult = {
        classroomId: c.id,
        matchedAge,
      };
      if (currentStatus === "PENDING" || currentStatus === "DRAFT") {
        wl.nextStatus = "WAITLIST";
      }
      return wl;
    }
  }

  return null;
}

/**
 * Pick matching class by sortOrder and assign seat or waitlist per class rules.
 * Linked sections (roundRobinGroupKey) rotate by fewest seated students.
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
    /** Merged per-child form answers (custom + standard keys like childFirstName). */
    childFieldContext: Record<string, string | boolean | number | null>;
  },
): Promise<AutoAssignResult> {
  const {
    childDob,
    registeredAt,
    seasonStartDate,
    currentStatus,
    classrooms,
    childFieldContext,
  } = params;

  const sorted = [...classrooms].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );

  const matching: { classroom: ClassroomForAutoAssign; matchedAge: number | null }[] = [];
  let lastMatchedAge: number | null = null;

  for (const c of sorted) {
    if (!c.isActive) continue;
    if (c.intakeStatus !== "OPEN") continue;

    const { matches, matchedAge } = classroomMatchesEligibility(
      c,
      childDob,
      registeredAt,
      seasonStartDate,
      childFieldContext,
    );
    if (!matches) continue;

    lastMatchedAge = matchedAge;
    matching.push({ classroom: c, matchedAge });
  }

  if (matching.length === 0) {
    return {
      classroomId: null,
      matchedAge: null,
      note: "Auto: no active class matched this child’s eligibility for this season.",
    };
  }

  const groups = new Map<string, { classroom: ClassroomForAutoAssign; matchedAge: number | null }[]>();
  for (const entry of matching) {
    const key = roundRobinGroupId(entry.classroom);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const aOrder = Math.min(...a[1].map((x) => x.classroom.sortOrder));
    const bOrder = Math.min(...b[1].map((x) => x.classroom.sortOrder));
    return aOrder - bOrder || a[0].localeCompare(b[0]);
  });

  for (const [, members] of sortedGroups) {
    const result = await pickFromRoundRobinGroup(
      tx,
      members.map((m) => m.classroom),
      currentStatus,
      members[0]?.matchedAge ?? lastMatchedAge,
    );
    if (result?.classroomId) return result;
    if (result) return result;
  }

  if (lastMatchedAge != null) {
    return {
      classroomId: null,
      matchedAge: lastMatchedAge,
      note:
        "Auto: every matching class (eligibility rules) is full (no waitlist or overflow class available).",
    };
  }

  return {
    classroomId: null,
    matchedAge: null,
    note: "Auto: no active class matched this child’s eligibility for this season.",
  };
}

export async function fetchClassroomsForAutoAssign(
  db: PrismaClient | Prisma.TransactionClient,
  seasonId: string,
): Promise<ClassroomForAutoAssign[]> {
  const rows = await db.classroom.findMany({
    where: { seasonId },
    select: {
      id: true,
      name: true,
      ageMin: true,
      ageMax: true,
      birthDateMin: true,
      birthDateMax: true,
      roundRobinGroupKey: true,
      useAgeRuleForAutoAssign: true,
      ageRule: true,
      capacity: true,
      waitlistEnabled: true,
      intakeStatus: true,
      isActive: true,
      sortOrder: true,
      matchFormFieldKey: true,
      matchFormFieldValues: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    ...r,
    matchFormFieldKey: r.matchFormFieldKey ?? null,
    matchFormFieldValues: jsonToStringArray(r.matchFormFieldValues),
  }));
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

  const fromJson = customResponsesAsRecord(reg.customResponses);
  const childFieldContext: Record<string, string | boolean | number | null> = {
    ...Object.fromEntries(
      Object.entries(fromJson).map(([k, v]) => [k, coerceJsonLeaf(v)]),
    ),
    childFirstName: reg.child.firstName,
    childLastName: reg.child.lastName,
    childDateOfBirth: reg.child.dateOfBirth.toISOString().slice(0, 10),
    allergiesNotes: reg.child.allergiesNotes ?? null,
  };

  await prisma.$transaction(async (tx) => {
    const classrooms = await fetchClassroomsForAutoAssign(tx, reg.seasonId);
    const result = await resolveAutoClassAssignment(tx, {
      childDob: reg.child.dateOfBirth,
      registeredAt: reg.registeredAt,
      seasonStartDate: reg.season.startDate,
      currentStatus: reg.status,
      classrooms,
      childFieldContext,
    });
    await applyAutoAssignmentToRegistration(tx, {
      registrationId,
      result,
      existingNotes: reg.notes,
    });
  });
}
