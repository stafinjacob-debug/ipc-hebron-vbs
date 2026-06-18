"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type SaveClassSettingsState = {
  ok: boolean;
  message: string;
};

function revalidateClassSettingsPaths(seasonId: string) {
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${seasonId}/class-settings`);
  revalidatePath("/classes");
  revalidatePath("/classes/settings");
  revalidatePath("/classes/auto-assign");
  revalidatePath("/registrations");
}

export async function saveClassSettings(
  seasonId: string,
  _prev: SaveClassSettingsState | null,
  formData: FormData,
): Promise<SaveClassSettingsState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to change these settings." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    return { ok: false, message: "Season not found." };
  }

  const classroomsEnabled = formData.get("classroomsEnabled") === "on";

  await prisma.vbsSeason.update({
    where: { id: seasonId },
    data: { classroomsEnabled },
  });

  revalidateClassSettingsPaths(seasonId);

  return {
    ok: true,
    message: classroomsEnabled
      ? "Class auto-assignment is enabled for this event."
      : "Class auto-assignment is disabled for this event.",
  };
}

export async function enableClassAutoAssignAction(
  seasonId: string,
): Promise<SaveClassSettingsState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to change these settings." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    return { ok: false, message: "Event not found." };
  }

  if (season.classroomsEnabled) {
    return { ok: true, message: "Class auto-assignment is already enabled." };
  }

  await prisma.vbsSeason.update({
    where: { id: seasonId },
    data: { classroomsEnabled: true },
  });

  revalidateClassSettingsPaths(seasonId);

  return {
    ok: true,
    message: "Class auto-assignment enabled. Re-run the simulation to see proposed placements.",
  };
}
