import type { Prisma, PrismaClient } from "@/generated/prisma";
import {
  buildInitialSeatedCounts,
  createVirtualSeatedCounter,
  fetchClassroomsForAutoAssign,
  resolveAutoClassAssignment,
} from "@/lib/class-assignment";
import type { ClassPlacementChildInput, ClassPlacementPreviewRow } from "@/lib/class-placement-gate";
import { parseLocalDate } from "@/lib/schemas/vbs-registration";

export type { ClassPlacementChildInput, ClassPlacementPreviewRow } from "@/lib/class-placement-gate";

function childLabel(first: string, last: string, index: number): string {
  const name = `${first} ${last}`.trim();
  return name || `Participant ${index + 1}`;
}

function childFieldContext(
  child: ClassPlacementChildInput,
): Record<string, string | boolean | number | null> {
  return {
    ...(child.custom ?? {}),
    childFirstName: child.childFirstName,
    childLastName: child.childLastName,
    childDateOfBirth: child.childDateOfBirth,
    allergiesNotes: null,
  };
}

/** Dry-run auto-assignment for a pending public registration (sibling order preserved). */
export async function previewClassPlacementForChildren(
  db: PrismaClient | Prisma.TransactionClient,
  params: {
    seasonId: string;
    children: ClassPlacementChildInput[];
  },
): Promise<ClassPlacementPreviewRow[]> {
  const season = await db.vbsSeason.findUnique({
    where: { id: params.seasonId },
    select: { id: true, startDate: true, classroomsEnabled: true },
  });
  if (!season?.classroomsEnabled || params.children.length === 0) {
    return params.children.map((c, index) => ({
      index,
      label: childLabel(c.childFirstName, c.childLastName, index),
      canPlace: true,
    }));
  }

  const classrooms = await fetchClassroomsForAutoAssign(db, season.id);
  if (classrooms.length === 0) {
    return params.children.map((c, index) => ({
      index,
      label: childLabel(c.childFirstName, c.childLastName, index),
      canPlace: false,
    }));
  }

  const initialCounts = await buildInitialSeatedCounts(
    db,
    season.id,
    classrooms.map((c) => c.id),
  );
  const { counter, recordAssignment } = createVirtualSeatedCounter(initialCounts);
  const registeredAt = new Date();
  const rows: ClassPlacementPreviewRow[] = [];

  for (let i = 0; i < params.children.length; i++) {
    const child = params.children[i]!;
    let dob: Date;
    try {
      dob = parseLocalDate(child.childDateOfBirth);
    } catch {
      rows.push({
        index: i,
        label: childLabel(child.childFirstName, child.childLastName, i),
        canPlace: false,
      });
      continue;
    }

    const result = await resolveAutoClassAssignment(db, {
      childDob: dob,
      registeredAt,
      seasonStartDate: season.startDate,
      currentStatus: "PENDING",
      classrooms,
      childFieldContext: childFieldContext(child),
      seatedCounter: counter,
    });

    const canPlace = result.classroomId != null;
    if (canPlace) {
      recordAssignment(result.classroomId!, result.nextStatus ?? "PENDING");
    }

    rows.push({
      index: i,
      label: childLabel(child.childFirstName, child.childLastName, i),
      canPlace,
    });
  }

  return rows;
}
