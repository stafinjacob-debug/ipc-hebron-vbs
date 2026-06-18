import type { RegistrationStatus } from "@/generated/prisma";
import { tryAutoApproveAfterRegistrationUpdate } from "@/lib/auto-approve-registration";
import { prisma } from "@/lib/prisma";
import { coerceJsonLeaf, customResponsesAsRecord } from "@/lib/class-form-field-match";
import {
  applyAutoAssignmentToRegistration,
  buildInitialSeatedCounts,
  createVirtualSeatedCounter,
  fetchClassroomsForAutoAssign,
  resolveAutoClassAssignment,
} from "@/lib/class-assignment";

export type AutoAssignSimulationOutcome =
  | "assignable"
  | "no_match"
  | "already_assigned";

export type AutoAssignSimulationRow = {
  registrationId: string;
  registrationNumber: string | null;
  childName: string;
  childDob: string;
  status: RegistrationStatus;
  registeredAt: string;
  currentClassroomId: string | null;
  currentClassroomName: string | null;
  outcome: AutoAssignSimulationOutcome;
  proposedClassroomId: string | null;
  proposedClassroomName: string | null;
  proposedStatus: RegistrationStatus | null;
  matchedAge: number | null;
  note: string | null;
};

export type AutoAssignSimulationSummary = {
  seasonId: string;
  seasonName: string;
  classroomsEnabled: boolean;
  totalRegistrations: number;
  alreadyAssigned: number;
  assignable: number;
  noMatch: number;
  rows: AutoAssignSimulationRow[];
};

function childFieldContextFromRegistration(reg: {
  child: { firstName: string; lastName: string; dateOfBirth: Date; allergiesNotes: string | null };
  customResponses: unknown;
}): Record<string, string | boolean | number | null> {
  const fromJson = customResponsesAsRecord(reg.customResponses);
  return {
    ...Object.fromEntries(
      Object.entries(fromJson).map(([k, v]) => [k, coerceJsonLeaf(v)]),
    ),
    childFirstName: reg.child.firstName,
    childLastName: reg.child.lastName,
    childDateOfBirth: reg.child.dateOfBirth.toISOString().slice(0, 10),
    allergiesNotes: reg.child.allergiesNotes ?? null,
  };
}

function effectiveStatusAfterAssign(
  current: RegistrationStatus,
  result: { nextStatus?: RegistrationStatus },
): RegistrationStatus {
  return result.nextStatus ?? current;
}

/** Dry-run auto-assignment for unassigned registrations (oldest first). */
export async function simulateAutoAssignForSeason(
  seasonId: string,
): Promise<AutoAssignSimulationSummary | null> {
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, name: true, startDate: true, classroomsEnabled: true },
  });
  if (!season) return null;

  const classrooms = season.classroomsEnabled
    ? await fetchClassroomsForAutoAssign(prisma, seasonId)
    : [];
  const classroomNames = new Map(classrooms.map((c) => [c.id, c.name]));

  const registrations = await prisma.registration.findMany({
    where: {
      seasonId,
      status: { not: "CANCELLED" },
    },
    include: {
      child: {
        select: {
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          allergiesNotes: true,
        },
      },
      classroom: { select: { id: true, name: true } },
    },
    orderBy: [{ registeredAt: "asc" }, { id: "asc" }],
  });

  const initialCounts = await buildInitialSeatedCounts(
    prisma,
    seasonId,
    classrooms.map((c) => c.id),
  );
  const virtual = createVirtualSeatedCounter(initialCounts);

  const rows: AutoAssignSimulationRow[] = [];
  let alreadyAssigned = 0;
  let assignable = 0;
  let noMatch = 0;

  await prisma.$transaction(async (tx) => {
    for (const reg of registrations) {
      const childName = `${reg.child.firstName} ${reg.child.lastName}`.trim();
      const base = {
        registrationId: reg.id,
        registrationNumber: reg.registrationNumber,
        childName,
        childDob: reg.child.dateOfBirth.toISOString().slice(0, 10),
        status: reg.status,
        registeredAt: reg.registeredAt.toISOString(),
        currentClassroomId: reg.classroomId,
        currentClassroomName: reg.classroom?.name ?? null,
        matchedAge: null as number | null,
        note: null as string | null,
      };

      if (reg.classroomId) {
        alreadyAssigned += 1;
        rows.push({
          ...base,
          outcome: "already_assigned",
          proposedClassroomId: reg.classroomId,
          proposedClassroomName: reg.classroom?.name ?? null,
          proposedStatus: reg.status,
        });
        continue;
      }

      if (!season.classroomsEnabled || classrooms.length === 0) {
        noMatch += 1;
        rows.push({
          ...base,
          outcome: "no_match",
          proposedClassroomId: null,
          proposedClassroomName: null,
          proposedStatus: null,
          note: "Classes are not enabled for this event.",
        });
        continue;
      }

      const result = await resolveAutoClassAssignment(tx, {
        childDob: reg.child.dateOfBirth,
        registeredAt: reg.registeredAt,
        seasonStartDate: season.startDate,
        currentStatus: reg.status,
        classrooms,
        childFieldContext: childFieldContextFromRegistration(reg),
        seatedCounter: virtual.counter,
        excludeRegistrationId: reg.id,
      });

      const proposedStatus = result.classroomId
        ? effectiveStatusAfterAssign(reg.status, result)
        : null;

      if (result.classroomId) {
        assignable += 1;
        virtual.recordAssignment(result.classroomId, proposedStatus ?? reg.status);
        rows.push({
          ...base,
          outcome: "assignable",
          proposedClassroomId: result.classroomId,
          proposedClassroomName: classroomNames.get(result.classroomId) ?? null,
          proposedStatus,
          matchedAge: result.matchedAge,
          note: result.note ?? null,
        });
      } else {
        noMatch += 1;
        rows.push({
          ...base,
          outcome: "no_match",
          proposedClassroomId: null,
          proposedClassroomName: null,
          proposedStatus: null,
          matchedAge: result.matchedAge,
          note: result.note ?? null,
        });
      }
    }
  });

  return {
    seasonId,
    seasonName: season.name,
    classroomsEnabled: season.classroomsEnabled,
    totalRegistrations: registrations.length,
    alreadyAssigned,
    assignable,
    noMatch,
    rows,
  };
}

/** Apply auto-assignment to selected unassigned registrations (registeredAt order). */
export async function applyAutoAssignBatch(
  seasonId: string,
  registrationIds: string[],
  actorUserId: string,
): Promise<{ applied: number; skipped: number; messages: string[] }> {
  const idSet = new Set(registrationIds);
  if (idSet.size === 0) return { applied: 0, skipped: 0, messages: [] };

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: { startDate: true, classroomsEnabled: true },
  });
  if (!season?.classroomsEnabled) {
    return { applied: 0, skipped: idSet.size, messages: ["Classes are not enabled for this event."] };
  }

  let applied = 0;
  let skipped = 0;
  const messages: string[] = [];
  const appliedIds: { registrationId: string; formSubmissionId: string | null }[] = [];

  await prisma.$transaction(async (tx) => {
    const classrooms = await fetchClassroomsForAutoAssign(tx, seasonId);
    const regs = await tx.registration.findMany({
      where: {
        seasonId,
        id: { in: [...idSet] },
        status: { not: "CANCELLED" },
        classroomId: null,
      },
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            allergiesNotes: true,
          },
        },
      },
      orderBy: [{ registeredAt: "asc" }, { id: "asc" }],
    });

    for (const reg of regs) {
      if (!idSet.has(reg.id)) continue;

      const result = await resolveAutoClassAssignment(tx, {
        childDob: reg.child.dateOfBirth,
        registeredAt: reg.registeredAt,
        seasonStartDate: season.startDate,
        currentStatus: reg.status,
        classrooms,
        childFieldContext: childFieldContextFromRegistration(reg),
        excludeRegistrationId: reg.id,
      });

      if (!result.classroomId) {
        skipped += 1;
        messages.push(
          `${reg.child.firstName} ${reg.child.lastName}: ${result.note ?? "No matching class."}`,
        );
        continue;
      }

      await applyAutoAssignmentToRegistration(tx, {
        registrationId: reg.id,
        result,
        existingNotes: reg.notes,
      });

      await tx.classAssignmentAuditLog.create({
        data: {
          registrationId: reg.id,
          fromClassroomId: null,
          toClassroomId: result.classroomId,
          method: "AUTO",
          reason: "Approved from auto-assign simulation",
          actorUserId,
        },
      });

      appliedIds.push({
        registrationId: reg.id,
        formSubmissionId: reg.formSubmissionId,
      });
      applied += 1;
    }
  });

  for (const item of appliedIds) {
    void tryAutoApproveAfterRegistrationUpdate(item).catch((err) =>
      console.error("[auto-approve] after batch auto-assign", err),
    );
  }

  return { applied, skipped, messages };
}
