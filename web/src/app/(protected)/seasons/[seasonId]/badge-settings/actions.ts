"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  parseBadgeCustomFieldsForm,
  parseBadgeLabelSize,
  parseBadgeOrientation,
} from "@/lib/badge-print";
import { deleteLocalBadgeLogo, uploadBadgeLogoImage } from "@/lib/badge-logo-upload";
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

  const existing = await prisma.badgePrintSettings.findUnique({ where: { seasonId } });
  let logoUrl = existing?.logoUrl ?? null;

  if (formData.get("removeLogo") === "on") {
    await deleteLocalBadgeLogo(logoUrl);
    logoUrl = null;
  } else {
    const file = formData.get("logoImage");
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadBadgeLogoImage(file, seasonId);
      if (!uploaded.ok) {
        return { ok: false, message: uploaded.error };
      }
      await deleteLocalBadgeLogo(logoUrl);
      logoUrl = uploaded.url;
    }
  }

  const customFields = parseBadgeCustomFieldsForm(str(formData, "customFieldsJson"));
  const customFieldsJson = customFields.map(({ id, label, text }) => ({ id, label, text }));

  await prisma.badgePrintSettings.upsert({
    where: { seasonId },
    create: {
      seasonId,
      enabled: checkbox(formData, "enabled"),
      labelSize: parseBadgeLabelSize(str(formData, "labelSize")),
      orientation: parseBadgeOrientation(str(formData, "orientation")),
      showChildName: checkbox(formData, "showChildName"),
      showRegistrationNumber: checkbox(formData, "showRegistrationNumber"),
      showClassroomName: checkbox(formData, "showClassroomName"),
      showBadgeDisplayName: checkbox(formData, "showBadgeDisplayName"),
      showCheckInLabel: checkbox(formData, "showCheckInLabel"),
      showSeasonName: checkbox(formData, "showSeasonName"),
      showQrCode: checkbox(formData, "showQrCode"),
      showAllergyFlag: checkbox(formData, "showAllergyFlag"),
      logoUrl,
      customFieldsJson,
      autoPrintOnCheckIn: checkbox(formData, "autoPrintOnCheckIn"),
    },
    update: {
      enabled: checkbox(formData, "enabled"),
      labelSize: parseBadgeLabelSize(str(formData, "labelSize")),
      orientation: parseBadgeOrientation(str(formData, "orientation")),
      showChildName: checkbox(formData, "showChildName"),
      showRegistrationNumber: checkbox(formData, "showRegistrationNumber"),
      showClassroomName: checkbox(formData, "showClassroomName"),
      showBadgeDisplayName: checkbox(formData, "showBadgeDisplayName"),
      showCheckInLabel: checkbox(formData, "showCheckInLabel"),
      showSeasonName: checkbox(formData, "showSeasonName"),
      showQrCode: checkbox(formData, "showQrCode"),
      showAllergyFlag: checkbox(formData, "showAllergyFlag"),
      logoUrl,
      customFieldsJson,
      autoPrintOnCheckIn: checkbox(formData, "autoPrintOnCheckIn"),
    },
  });

  revalidatePath("/seasons");
  revalidatePath("/check-in");
  revalidatePath("/reports");
  revalidatePath(`/seasons/${seasonId}/badge-settings`);

  return { ok: true, message: "Badge printing settings saved." };
}
