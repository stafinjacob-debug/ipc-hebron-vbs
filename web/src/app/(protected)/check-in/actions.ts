"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import { canUseCheckInActions } from "@/lib/permissions";

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
