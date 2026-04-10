"use server";

import { auth } from "@/auth";
import type {
  ClassLeaderRole,
  ClassroomAgeRule,
  ClassroomIntakeStatus,
} from "@/generated/prisma";
import {
  ageForClassroomRule,
  ageRangeOverlaps,
  countSeatedRegistrations,
} from "@/lib/class-assignment";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type ClassActionState = {
  ok: boolean;
  message: string;
  warnings?: string[];
  /** Set after successful create — use to link to edit/leaders. */
  classroomId?: string;
};

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

function intField(fd: FormData, k: string, fallback: number) {
  const n = Number(str(fd, k));
  return Number.isFinite(n) ? n : fallback;
}

async function requireClassManager(): Promise<
  { ok: false; message: string } | { ok: true; userId: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { ok: false, message: "Sign in required." };
  }
  if (!canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to manage classes." };
  }
  return { ok: true, userId: session.user.id };
}

function overlapWarnings(
  ageMin: number,
  ageMax: number,
  excludeId: string | undefined,
  others: { id: string; name: string; ageMin: number; ageMax: number }[],
): string[] {
  const w: string[] = [];
  for (const o of others) {
    if (excludeId && o.id === excludeId) continue;
    if (ageRangeOverlaps(ageMin, ageMax, o.ageMin, o.ageMax)) {
      w.push(
        `Age range overlaps “${o.name}” (${o.ageMin}–${o.ageMax}). Adjust ranges or priority if needed.`,
      );
    }
  }
  return w;
}

export async function createClassroomAction(
  _prev: ClassActionState | null,
  formData: FormData,
): Promise<ClassActionState> {
  const gate = await requireClassManager();
  if (!gate.ok) return { ok: false, message: gate.message };

  const seasonId = str(formData, "seasonId").trim();
  const name = str(formData, "name").trim();
  if (!seasonId || !name) {
    return { ok: false, message: "Season and class name are required." };
  }

  const ageMin = intField(formData, "ageMin", 0);
  const ageMax = intField(formData, "ageMax", 99);
  if (ageMin > ageMax) {
    return { ok: false, message: "Minimum age cannot be greater than maximum age." };
  }

  const ageRule = (str(formData, "ageRule") as ClassroomAgeRule) || "EVENT_START_DATE";
  const intakeStatus = (str(formData, "intakeStatus") as ClassroomIntakeStatus) || "OPEN";

  const others = await prisma.classroom.findMany({
    where: { seasonId, isActive: true },
    select: { id: true, name: true, ageMin: true, ageMax: true },
  });
  const warnings = overlapWarnings(ageMin, ageMax, undefined, others);

  try {
    const created = await prisma.classroom.create({
      data: {
        seasonId,
        name,
        internalCode: str(formData, "internalCode").trim() || null,
        description: str(formData, "description").trim() || null,
        ageMin,
        ageMax,
        ageRule: ageRule === "REGISTRATION_DATE" ? "REGISTRATION_DATE" : "EVENT_START_DATE",
        gradeLabel: str(formData, "gradeLabel").trim() || null,
        eligibilityNotes: str(formData, "eligibilityNotes").trim() || null,
        capacity: Math.max(0, intField(formData, "capacity", 20)),
        waitlistEnabled: str(formData, "waitlistEnabled") !== "false",
        intakeStatus: intakeStatus === "CLOSED" ? "CLOSED" : "OPEN",
        room: str(formData, "room").trim() || null,
        checkInLabel: str(formData, "checkInLabel").trim() || null,
        badgeDisplayName: str(formData, "badgeDisplayName").trim() || null,
        adminNotes: str(formData, "adminNotes").trim() || null,
        sortOrder: intField(formData, "sortOrder", 0),
        isActive: str(formData, "isActive") !== "false",
      },
    });
    revalidatePath("/classes");
    revalidatePath(`/seasons`);
    return {
      ok: true,
      message: "Class created. You can assign leaders next.",
      classroomId: created.id,
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Could not create class." };
  }
}

export async function updateClassroomAction(
  _prev: ClassActionState | null,
  formData: FormData,
): Promise<ClassActionState> {
  const gate = await requireClassManager();
  if (!gate.ok) return { ok: false, message: gate.message };

  const classroomId = str(formData, "classroomId").trim();
  const name = str(formData, "name").trim();
  if (!classroomId || !name) {
    return { ok: false, message: "Missing class or name." };
  }

  const existing = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { seasonId: true },
  });
  if (!existing) return { ok: false, message: "Class not found." };

  const ageMin = intField(formData, "ageMin", 0);
  const ageMax = intField(formData, "ageMax", 99);
  if (ageMin > ageMax) {
    return { ok: false, message: "Minimum age cannot be greater than maximum age." };
  }

  const ageRule = (str(formData, "ageRule") as ClassroomAgeRule) || "EVENT_START_DATE";
  const intakeStatus = (str(formData, "intakeStatus") as ClassroomIntakeStatus) || "OPEN";

  const others = await prisma.classroom.findMany({
    where: { seasonId: existing.seasonId, isActive: true },
    select: { id: true, name: true, ageMin: true, ageMax: true },
  });
  const warnings = overlapWarnings(ageMin, ageMax, classroomId, others);

  try {
    await prisma.classroom.update({
      where: { id: classroomId },
      data: {
        name,
        internalCode: str(formData, "internalCode").trim() || null,
        description: str(formData, "description").trim() || null,
        ageMin,
        ageMax,
        ageRule: ageRule === "REGISTRATION_DATE" ? "REGISTRATION_DATE" : "EVENT_START_DATE",
        gradeLabel: str(formData, "gradeLabel").trim() || null,
        eligibilityNotes: str(formData, "eligibilityNotes").trim() || null,
        capacity: Math.max(0, intField(formData, "capacity", 20)),
        waitlistEnabled: str(formData, "waitlistEnabled") !== "false",
        intakeStatus: intakeStatus === "CLOSED" ? "CLOSED" : "OPEN",
        room: str(formData, "room").trim() || null,
        checkInLabel: str(formData, "checkInLabel").trim() || null,
        badgeDisplayName: str(formData, "badgeDisplayName").trim() || null,
        adminNotes: str(formData, "adminNotes").trim() || null,
        sortOrder: intField(formData, "sortOrder", 0),
        isActive: str(formData, "isActive") !== "false",
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Could not update class." };
  }

  revalidatePath("/classes");
  revalidatePath(`/classes/${classroomId}`);
  revalidatePath(`/classes/${classroomId}/edit`);
  return {
    ok: true,
    message: "Class saved.",
    warnings: warnings.length ? warnings : undefined,
  };
}

export async function deleteClassroomAction(classroomId: string): Promise<ClassActionState> {
  const gate = await requireClassManager();
  if (!gate.ok) return { ok: false, message: gate.message };

  const n = await prisma.registration.count({
    where: { classroomId, status: { not: "CANCELLED" } },
  });
  if (n > 0) {
    return {
      ok: false,
      message: `This class still has ${n} registration(s). Reassign or remove them before deleting.`,
    };
  }

  await prisma.classroom.delete({ where: { id: classroomId } });
  revalidatePath("/classes");
  return { ok: true, message: "Class deleted." };
}

export async function duplicateClassroomAction(classroomId: string): Promise<ClassActionState> {
  const gate = await requireClassManager();
  if (!gate.ok) return { ok: false, message: gate.message };

  const src = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!src) return { ok: false, message: "Class not found." };

  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = src;
  await prisma.classroom.create({
    data: {
      ...rest,
      name: `${src.name} (copy)`,
      sortOrder: src.sortOrder + 1,
    },
  });

  revalidatePath("/classes");
  return { ok: true, message: "Class duplicated." };
}

export async function setClassroomIntakeAction(
  classroomId: string,
  intakeStatus: ClassroomIntakeStatus,
): Promise<ClassActionState> {
  const gate = await requireClassManager();
  if (!gate.ok) return { ok: false, message: gate.message };

  await prisma.classroom.update({
    where: { id: classroomId },
    data: { intakeStatus: intakeStatus === "CLOSED" ? "CLOSED" : "OPEN" },
  });
  revalidatePath("/classes");
  revalidatePath(`/classes/${classroomId}`);
  return { ok: true, message: intakeStatus === "CLOSED" ? "Class closed to new auto-placement." : "Class opened." };
}

export async function updateClassroomLeadersAction(
  _prev: ClassActionState | null,
  formData: FormData,
): Promise<ClassActionState> {
  const gate = await requireClassManager();
  if (!gate.ok) return { ok: false, message: gate.message };

  const classroomId = str(formData, "classroomId").trim();
  if (!classroomId) return { ok: false, message: "Missing class." };

  const primary = str(formData, "primaryLeaderId").trim();
  const assistants = formData.getAll("assistantLeaderIds").map(String).filter(Boolean);

  const rows: { userId: string; role: ClassLeaderRole }[] = [];
  if (primary) rows.push({ userId: primary, role: "PRIMARY" });
  const seen = new Set<string>(primary ? [primary] : []);
  for (const uid of assistants) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    rows.push({ userId: uid, role: "ASSISTANT" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.classroomLeaderAssignment.deleteMany({ where: { classroomId } });
    if (rows.length) {
      await tx.classroomLeaderAssignment.createMany({
        data: rows.map((r) => ({
          classroomId,
          userId: r.userId,
          role: r.role,
        })),
      });
    }
  });

  revalidatePath("/classes");
  revalidatePath(`/classes/${classroomId}`);
  revalidatePath(`/classes/${classroomId}/edit`);
  return { ok: true, message: "Leaders updated." };
}

export async function reassignRegistrationClassroomAction(
  registrationId: string,
  classroomId: string | null,
  reason: string | null,
): Promise<ClassActionState & { hints?: string[] }> {
  const gate = await requireClassManager();
  if (!gate.ok) return { ok: false, message: gate.message };

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: true,
      season: true,
      classroom: true,
    },
  });
  if (!reg) return { ok: false, message: "Registration not found." };

  let target = null as Awaited<ReturnType<typeof prisma.classroom.findUnique>>;
  if (classroomId) {
    target = await prisma.classroom.findFirst({
      where: { id: classroomId, seasonId: reg.seasonId },
    });
    if (!target) return { ok: false, message: "That class is not in the same season." };
  }

  const hints: string[] = [];

  if (target) {
    const age = ageForClassroomRule(
      reg.child.dateOfBirth,
      target.ageRule,
      reg.registeredAt,
      reg.season.startDate,
    );
    if (age < target.ageMin || age > target.ageMax) {
      hints.push(
        `Child’s age (${age} using ${target.ageRule === "REGISTRATION_DATE" ? "registration date" : "event start"} rule) is outside this class band (${target.ageMin}–${target.ageMax}).`,
      );
    }

    const seated = await countSeatedRegistrations(prisma, target.id, registrationId);
    if (target.capacity > 0 && seated >= target.capacity) {
      hints.push(
        "This class is already at or over seat capacity. Moving here may overcrowd the room unless you adjust capacity.",
      );
    }
  }

  const fromId = reg.classroomId;

  await prisma.$transaction(async (tx) => {
    await tx.registration.update({
      where: { id: registrationId },
      data: {
        classroomId: classroomId ?? null,
        classAssignmentMethod: "MANUAL",
        classOverrideReason: reason?.trim() || null,
      },
    });
    await tx.classAssignmentAuditLog.create({
      data: {
        registrationId,
        fromClassroomId: fromId,
        toClassroomId: classroomId,
        method: "MANUAL",
        reason: reason?.trim() || null,
        actorUserId: gate.userId,
      },
    });
  });

  revalidatePath(`/registrations/${registrationId}`);
  revalidatePath("/classes");
  if (fromId) revalidatePath(`/classes/${fromId}`);
  if (classroomId) revalidatePath(`/classes/${classroomId}`);

  return {
    ok: true,
    message: classroomId ? "Class assignment updated." : "Student unassigned from class.",
    hints: hints.length ? hints : undefined,
  };
}
