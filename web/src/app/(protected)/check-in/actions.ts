"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import {
  findCheckInRegistrationsForInput,
  mapRegistrationToCheckInLookupMatch,
  parseCheckInLookupInput,
  type CheckInLookupMatch,
} from "@/lib/check-in-lookup";
import { canUseCheckInActions } from "@/lib/permissions";

export type LookupRegistrationForCheckInResult =
  | { ok: true; matches: CheckInLookupMatch[] }
  | { ok: false; message: string };

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

  return { ok: true, matches: rows.map(mapRegistrationToCheckInLookupMatch) };
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
