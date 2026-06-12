"use server";

import { auth } from "@/auth";
import {
  parseCheckInBlockSettings,
  serializeCheckInBlockSettings,
  type CheckInBlockSettings,
} from "@/lib/check-in-block";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type SaveCheckInSettingsState = {
  ok: boolean;
  message: string;
};

function parseBlockedValues(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseUndoPin(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d{4}$/.test(trimmed)) {
    throw new Error("INVALID_PIN");
  }
  return trimmed;
}

export async function saveCheckInSettings(
  seasonId: string,
  _prev: SaveCheckInSettingsState | null,
  formData: FormData,
): Promise<SaveCheckInSettingsState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to change these settings." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    return { ok: false, message: "Season not found." };
  }

  let undoPin: string | null;
  try {
    undoPin = parseUndoPin(formData.get("checkInUndoPin"));
  } catch {
    return { ok: false, message: "Security code must be exactly 4 digits, or left blank." };
  }

  const blockSettings: CheckInBlockSettings = {
    enabled: formData.get("checkInBlockEnabled") === "on",
    fieldKey:
      typeof formData.get("checkInBlockFieldKey") === "string"
        ? String(formData.get("checkInBlockFieldKey")).trim()
        : parseCheckInBlockSettings(null).fieldKey,
    blockedValues: parseBlockedValues(formData.get("checkInBlockValues")),
    message:
      typeof formData.get("checkInBlockMessage") === "string"
        ? String(formData.get("checkInBlockMessage")).trim()
        : parseCheckInBlockSettings(null).message,
  };

  await prisma.vbsSeason.update({
    where: { id: seasonId },
    data: {
      multiDayCheckInEnabled: formData.get("multiDayCheckInEnabled") === "on",
      dismissalTrackingEnabled: formData.get("dismissalTrackingEnabled") === "on",
      checkInBlockRulesJson: serializeCheckInBlockSettings(blockSettings),
      checkInUndoPin: undoPin,
    },
  });

  revalidatePath("/seasons");
  revalidatePath("/check-in");
  revalidatePath("/reports");
  revalidatePath(`/seasons/${seasonId}/check-in-settings`);

  return { ok: true, message: "Check-in settings saved." };
}
