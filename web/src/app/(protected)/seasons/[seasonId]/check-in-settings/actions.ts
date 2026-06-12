"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type SaveCheckInSettingsState = {
  ok: boolean;
  message: string;
};

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

  await prisma.vbsSeason.update({
    where: { id: seasonId },
    data: {
      multiDayCheckInEnabled: formData.get("multiDayCheckInEnabled") === "on",
      dismissalTrackingEnabled: formData.get("dismissalTrackingEnabled") === "on",
    },
  });

  revalidatePath("/seasons");
  revalidatePath("/check-in");
  revalidatePath("/reports");
  revalidatePath(`/seasons/${seasonId}/check-in-settings`);

  return { ok: true, message: "Check-in settings saved." };
}
