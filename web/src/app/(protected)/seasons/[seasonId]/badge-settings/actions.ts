"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBadgeLabelSize } from "@/lib/badge-print";
import { canManageDirectory } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type SaveBadgePrintSettingsState = {
  ok: boolean;
  message: string;
};

function str(formData: FormData, k: string) {
  const v = formData.get(k);
  return typeof v === "string" ? v : "";
}

function checkbox(formData: FormData, k: string) {
  return formData.get(k) === "on";
}

export async function saveBadgePrintSettings(
  seasonId: string,
  _prev: SaveBadgePrintSettingsState | null,
  formData: FormData,
): Promise<SaveBadgePrintSettingsState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to change these settings." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    return { ok: false, message: "Season not found." };
  }

  const logoRaw = str(formData, "logoUrl").trim();
  const logoUrl = logoRaw.length > 0 ? logoRaw : null;
  if (logoUrl && !/^https?:\/\//i.test(logoUrl) && !logoUrl.startsWith("/")) {
    return { ok: false, message: "Logo URL must be an https:// link or a site path starting with /." };
  }

  await prisma.badgePrintSettings.upsert({
    where: { seasonId },
    create: {
      seasonId,
      enabled: checkbox(formData, "enabled"),
      labelSize: parseBadgeLabelSize(str(formData, "labelSize")),
      showChildName: checkbox(formData, "showChildName"),
      showRegistrationNumber: checkbox(formData, "showRegistrationNumber"),
      showClassroomName: checkbox(formData, "showClassroomName"),
      showBadgeDisplayName: checkbox(formData, "showBadgeDisplayName"),
      showCheckInLabel: checkbox(formData, "showCheckInLabel"),
      showSeasonName: checkbox(formData, "showSeasonName"),
      showQrCode: checkbox(formData, "showQrCode"),
      showAllergyFlag: checkbox(formData, "showAllergyFlag"),
      logoUrl,
      autoPrintOnCheckIn: checkbox(formData, "autoPrintOnCheckIn"),
    },
    update: {
      enabled: checkbox(formData, "enabled"),
      labelSize: parseBadgeLabelSize(str(formData, "labelSize")),
      showChildName: checkbox(formData, "showChildName"),
      showRegistrationNumber: checkbox(formData, "showRegistrationNumber"),
      showClassroomName: checkbox(formData, "showClassroomName"),
      showBadgeDisplayName: checkbox(formData, "showBadgeDisplayName"),
      showCheckInLabel: checkbox(formData, "showCheckInLabel"),
      showSeasonName: checkbox(formData, "showSeasonName"),
      showQrCode: checkbox(formData, "showQrCode"),
      showAllergyFlag: checkbox(formData, "showAllergyFlag"),
      logoUrl,
      autoPrintOnCheckIn: checkbox(formData, "autoPrintOnCheckIn"),
    },
  });

  revalidatePath("/seasons");
  revalidatePath("/check-in");
  revalidatePath("/reports");
  revalidatePath(`/seasons/${seasonId}/badge-settings`);

  return { ok: true, message: "Badge printing settings saved." };
}
