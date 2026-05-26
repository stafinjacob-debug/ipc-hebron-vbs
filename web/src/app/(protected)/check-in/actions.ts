"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import { parseCheckInLookupInput, type CheckInLookupMatch } from "@/lib/check-in-lookup";
import { canUseCheckInActions } from "@/lib/permissions";

export type LookupRegistrationForCheckInResult =
  | { ok: true; matches: CheckInLookupMatch[] }
  | { ok: false; message: string };

function mapRegistrationToLookupMatch(r: {
  id: string;
  status: string;
  checkedInAt: Date | null;
  registrationNumber: string | null;
  child: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    allergiesNotes: string | null;
    guardian: { firstName: string; lastName: string };
  };
  classroom: { name: string } | null;
  formSubmission: { registrationCode: string } | null;
}): CheckInLookupMatch {
  const guardian = r.child.guardian;
  return {
    id: r.id,
    studentName: `${r.child.firstName} ${r.child.lastName}`.trim(),
    className: r.classroom?.name ?? "—",
    checkedIn: Boolean(r.checkedInAt),
    registrationNumber: r.registrationNumber,
    submissionCode: r.formSubmission?.registrationCode ?? null,
    guardianName: `${guardian.firstName} ${guardian.lastName}`.trim() || null,
    dateOfBirth: r.child.dateOfBirth.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    }),
    allergiesNotes: r.child.allergiesNotes?.trim() || null,
    registrationStatus: r.status,
  };
}

export async function lookupRegistrationForCheckIn(
  seasonId: string,
  rawInput: string,
): Promise<LookupRegistrationForCheckInResult> {
  const session = await auth();
  if (!session?.user?.role || !canUseCheckInActions(session.user.role)) {
    return { ok: false, message: "You do not have permission to look up registrations." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId }, select: { id: true, name: true } });
  if (!season) return { ok: false, message: "Season not found." };

  const parsed = parseCheckInLookupInput(rawInput);
  if (!parsed.checkInToken && !parsed.plainCode) {
    return { ok: false, message: "Enter a registration code or scan a check-in QR code." };
  }

  const baseWhere = {
    seasonId,
    status: { not: "CANCELLED" as const },
  };

  const include = {
    child: { include: { guardian: true } },
    classroom: true,
    formSubmission: { select: { registrationCode: true } },
  } as const;

  if (parsed.checkInToken) {
    const reg = await prisma.registration.findFirst({
      where: { ...baseWhere, checkInToken: parsed.checkInToken },
      include,
    });
    if (!reg) {
      return { ok: false, message: "No registration found for that QR code in the active season." };
    }
    return { ok: true, matches: [mapRegistrationToLookupMatch(reg)] };
  }

  const code = parsed.plainCode!;
  const byNumber = await prisma.registration.findMany({
    where: {
      ...baseWhere,
      registrationNumber: { equals: code, mode: "insensitive" },
    },
    include,
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
  });
  if (byNumber.length > 0) {
    return { ok: true, matches: byNumber.map(mapRegistrationToLookupMatch) };
  }

  const bySubmission = await prisma.registration.findMany({
    where: {
      ...baseWhere,
      formSubmission: { registrationCode: { equals: code, mode: "insensitive" } },
    },
    include,
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
  });
  if (bySubmission.length > 0) {
    return { ok: true, matches: bySubmission.map(mapRegistrationToLookupMatch) };
  }

  return {
    ok: false,
    message: `No registration found for “${code}” in ${season.name}. Try the child’s registration number or family submission code.`,
  };
}

export type ToggleCheckInResult = {
  ok: boolean;
  message: string;
  shouldPrintBadge?: boolean;
};

export async function toggleCheckIn(
  registrationId: string,
  nextChecked: boolean,
): Promise<ToggleCheckInResult> {
  const session = await auth();
  if (!session?.user?.role || !canUseCheckInActions(session.user.role)) {
    return { ok: false, message: "You do not have permission to check in students." };
  }

  if (!registrationId) {
    return { ok: false, message: "Invalid registration." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { seasonId: true },
  });
  if (!reg) {
    return { ok: false, message: "Registration not found." };
  }

  const badgeSettings = await prisma.badgePrintSettings.findUnique({
    where: { seasonId: reg.seasonId },
  });
  const resolved = resolveBadgePrintSettings(badgeSettings);

  await prisma.registration.update({
    where: { id: registrationId },
    data: { checkedInAt: nextChecked ? new Date() : null },
  });

  revalidatePath("/check-in");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: nextChecked ? "Checked in." : "Check-in undone.",
    shouldPrintBadge: nextChecked && resolved.enabled && resolved.autoPrintOnCheckIn,
  };
}

/** @deprecated Use toggleCheckIn from the client check-in desk. */
export async function toggleCheckInForm(formData: FormData) {
  const session = await auth();
  if (!session?.user?.role || !canUseCheckInActions(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const registrationId = formData.get("registrationId");
  const nextChecked = formData.get("nextChecked") === "1";
  if (typeof registrationId !== "string" || !registrationId) {
    throw new Error("Invalid registration");
  }

  const result = await toggleCheckIn(registrationId, nextChecked);
  if (!result.ok) throw new Error(result.message);
}
