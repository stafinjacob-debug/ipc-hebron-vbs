"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import {
  loadSeasonAttendanceContext,
  resolveCheckedInMap,
  setRegistrationAttendance,
} from "@/lib/attendance";
import {
  findCheckInRegistrationsForInput,
  mapRegistrationToCheckInLookupMatch,
  parseCheckInLookupInput,
  type CheckInLookupMatch,
} from "@/lib/check-in-lookup";
import {
  CHECK_IN_BLOCK_REGISTRATION_SELECT,
  evaluateCheckInBlock,
  parseCheckInBlockSettings,
  type CheckInBlockRegistrationRow,
} from "@/lib/check-in-block";
import { canUseCheckInActions } from "@/lib/permissions";

export type LookupRegistrationForCheckInResult =
  | { ok: true; matches: CheckInLookupMatch[] }
  | { ok: false; message: string };

export async function lookupRegistrationForCheckIn(
  seasonId: string,
  rawInput: string,
  campDateKey?: string | null,
): Promise<LookupRegistrationForCheckInResult> {
  const session = await auth();
  if (!session?.user?.role || !canUseCheckInActions(session.user.role)) {
    return { ok: false, message: "You do not have permission to look up registrations." };
  }

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      multiDayCheckInEnabled: true,
      startDate: true,
      endDate: true,
      checkInBlockRulesJson: true,
    },
  });
  if (!season) return { ok: false, message: "Season not found." };

  const parsed = parseCheckInLookupInput(rawInput);
  if (!parsed.checkInToken && !parsed.plainCode) {
    return { ok: false, message: "Enter a name, registration code, or scan a check-in QR code." };
  }

  const rows = await findCheckInRegistrationsForInput(seasonId, rawInput);
  if (rows.length === 0) {
    const label = parsed.plainCode ?? "that code";
    return {
      ok: false,
      message: `No registration found for “${label}” in ${season.name}. Try the child’s full name, registration number (e.g. IPC--001), or family submission code.`,
    };
  }

  const context = await loadSeasonAttendanceContext(seasonId, campDateKey);
  const campDate = context?.defaultCampDate ?? campDateKey ?? "";
  const checkedInMap = await resolveCheckedInMap(
    rows.map((r) => r.id),
    campDate,
    season.multiDayCheckInEnabled,
  );

  const blockSettings = parseCheckInBlockSettings(season.checkInBlockRulesJson);
  const blockRows =
    blockSettings.enabled && rows.length > 0
      ? await prisma.registration.findMany({
          where: { id: { in: rows.map((r) => r.id) } },
          select: CHECK_IN_BLOCK_REGISTRATION_SELECT,
        })
      : [];
  const blockRowMap = new Map(blockRows.map((r) => [r.id, r]));

  return {
    ok: true,
    matches: rows.map((r) => {
      const match = mapRegistrationToCheckInLookupMatch(r, checkedInMap.get(r.id) ?? false);
      const blockRow = blockRowMap.get(r.id);
      if (blockRow) {
        const block = evaluateCheckInBlock(
          blockRow as CheckInBlockRegistrationRow,
          season.name,
          blockSettings,
        );
        if (block.blocked) {
          match.checkInBlocked = true;
          match.checkInBlockMessage = block.message;
        }
      }
      return match;
    }),
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
  campDateKey?: string | null,
  undoPin?: string | null,
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

  const result = await setRegistrationAttendance({
    registrationId,
    seasonId: reg.seasonId,
    checkedIn: nextChecked,
    campDateKey,
    actorUserId: session.user.id,
    undoPin,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

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
