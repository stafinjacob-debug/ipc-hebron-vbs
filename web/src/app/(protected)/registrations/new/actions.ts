"use server";

import { auth } from "@/auth";
import {
  applyAutoAssignmentToRegistration,
  fetchClassroomsForAutoAssign,
  resolveAutoClassAssignment,
} from "@/lib/class-assignment";
import { sendRegistrationApprovedEmail } from "@/lib/email/registration-emails";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { makeCheckInToken, makeUniqueRegistrationNumber } from "@/lib/registration-identity";
import { childAgeYearsOnDate } from "@/lib/class-assignment-shared";
import {
  parseLocalDate,
  vbsRegistrationFormSchema,
} from "@/lib/schemas/vbs-registration";

export type RegistrationFormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createVbsRegistration(
  _prev: RegistrationFormState | null,
  formData: FormData,
): Promise<RegistrationFormState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to add registrations." };
  }

  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };

  const raw = {
    seasonId: str("seasonId"),
    classroomId: str("classroomId"),
    guardianFirstName: str("guardianFirstName"),
    guardianLastName: str("guardianLastName"),
    guardianEmail: str("guardianEmail"),
    guardianPhone: str("guardianPhone"),
    childFirstName: str("childFirstName"),
    childLastName: str("childLastName"),
    childDateOfBirth: str("childDateOfBirth"),
    allergiesNotes: str("allergiesNotes"),
    status: str("status") || "CONFIRMED",
    notes: str("notes"),
  };

  const parsed = vbsRegistrationFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<
      string,
      string[]
    >;
    return {
      ok: false,
      message: "Fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  if (data.classroomId) {
    const room = await prisma.classroom.findFirst({
      where: { id: data.classroomId, seasonId: data.seasonId },
      select: { id: true },
    });
    if (!room) {
      return {
        ok: false,
        message: "Selected class does not belong to that season.",
        fieldErrors: { classroomId: ["Pick a class for this season or leave blank."] },
      };
    }
  }

  const season = await prisma.vbsSeason.findUnique({
    where: { id: data.seasonId },
    select: { id: true, year: true, startDate: true },
  });
  if (!season) {
    return { ok: false, message: "That VBS season no longer exists." };
  }

  const regForm = await prisma.registrationForm.findUnique({
    where: { seasonId: data.seasonId },
    select: { minimumParticipantAgeYears: true, maximumParticipantAgeYears: true },
  });
  const minYears = regForm?.minimumParticipantAgeYears;
  const maxYears = regForm?.maximumParticipantAgeYears;

  let childDob: Date;
  try {
    childDob = parseLocalDate(data.childDateOfBirth);
  } catch {
    return {
      ok: false,
      message: "Invalid date of birth.",
      fieldErrors: { childDateOfBirth: ["Use a valid date"] },
    };
  }

  if (
    (minYears != null && minYears >= 1) ||
    (maxYears != null && maxYears >= 1)
  ) {
    const age = childAgeYearsOnDate(childDob, season.startDate);
    const startLabel = season.startDate.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (minYears != null && minYears >= 1 && age < minYears) {
      return {
        ok: false,
        message: `This season requires children to be at least ${minYears} years old on the first day of VBS (${startLabel}).`,
        fieldErrors: {
          childDateOfBirth: [
            `Must be at least ${minYears} on the program start date (${startLabel}).`,
          ],
        },
      };
    }
    if (maxYears != null && maxYears >= 1 && age > maxYears) {
      return {
        ok: false,
        message: `This season requires children to be at most ${maxYears} years old on the first day of VBS (${startLabel}).`,
        fieldErrors: {
          childDateOfBirth: [
            `Must be at most ${maxYears} on the program start date (${startLabel}).`,
          ],
        },
      };
    }
  }

  try {
    const newRegistrationId = await prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.create({
        data: {
          firstName: data.guardianFirstName,
          lastName: data.guardianLastName,
          email: data.guardianEmail ?? null,
          phone: data.guardianPhone ?? null,
        },
      });

      const child = await tx.child.create({
        data: {
          firstName: data.childFirstName,
          lastName: data.childLastName,
          dateOfBirth: childDob,
          allergiesNotes: data.allergiesNotes ?? null,
          guardianId: guardian.id,
        },
      });

      const registrationNumber = await makeUniqueRegistrationNumber(season.year, tx);
      const checkInToken = makeCheckInToken();

      const registeredAt = new Date();

      const reg = await tx.registration.create({
        data: {
          childId: child.id,
          seasonId: data.seasonId,
          classroomId: data.classroomId ?? null,
          status: data.status,
          notes: data.notes ?? null,
          registrationNumber,
          checkInToken,
          classAssignmentMethod: data.classroomId ? "MANUAL" : undefined,
        },
      });

      if (!data.classroomId) {
        const classrooms = await fetchClassroomsForAutoAssign(tx, data.seasonId);
        const childFieldContext: Record<string, string | boolean | number | null> = {
          childFirstName: data.childFirstName,
          childLastName: data.childLastName,
          childDateOfBirth: data.childDateOfBirth,
          allergiesNotes: data.allergiesNotes ?? null,
        };
        const assignResult = await resolveAutoClassAssignment(tx, {
          childDob: childDob,
          registeredAt,
          seasonStartDate: season.startDate,
          currentStatus: data.status,
          classrooms,
          childFieldContext,
        });
        await applyAutoAssignmentToRegistration(tx, {
          registrationId: reg.id,
          result: assignResult,
          existingNotes: data.notes ?? null,
        });
      }

      return reg.id;
    });

    if (data.status === "CONFIRMED" && data.guardianEmail?.trim()) {
      void sendRegistrationApprovedEmail(newRegistrationId, { recordSentTimestamp: true }).catch((err) => {
        console.error("[sendRegistrationApprovedEmail staff]", err);
      });
    }

    return {
      ok: true,
      message: `${data.childFirstName} ${data.childLastName} is registered for this season.`,
    };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    if (code === "P2002") {
      return {
        ok: false,
        message:
          "That child is already registered for this season (same profile). Add a note in the office if this is a duplicate signup.",
      };
    }
    console.error(e);
    return {
      ok: false,
      message: "Something went wrong saving the registration. Try again.",
    };
  }
}
