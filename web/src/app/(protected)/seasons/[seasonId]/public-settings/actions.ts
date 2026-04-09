"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import {
  deleteLocalRegistrationBackground,
  uploadRegistrationBackgroundImage,
} from "@/lib/registration-background-upload";
import { revalidatePath } from "next/cache";

export type SavePublicSettingsState = {
  ok: boolean;
  message: string;
};

function str(formData: FormData, k: string) {
  const v = formData.get(k);
  return typeof v === "string" ? v : "";
}

export async function savePublicRegistrationSettings(
  seasonId: string,
  _prev: SavePublicSettingsState | null,
  formData: FormData,
): Promise<SavePublicSettingsState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to change these settings." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    return { ok: false, message: "Season not found." };
  }

  const existing = await prisma.publicRegistrationSettings.findUnique({
    where: { seasonId },
  });

  let registrationBackgroundImageUrl =
    existing?.registrationBackgroundImageUrl ?? null;

  if (formData.get("removeBackgroundImage") === "on") {
    await deleteLocalRegistrationBackground(registrationBackgroundImageUrl);
    registrationBackgroundImageUrl = null;
  } else {
    const file = formData.get("backgroundImage");
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadRegistrationBackgroundImage(file, seasonId);
      if (!uploaded.ok) {
        return { ok: false, message: uploaded.error };
      }
      await deleteLocalRegistrationBackground(registrationBackgroundImageUrl);
      registrationBackgroundImageUrl = uploaded.url;
    }
  }

  const publicOpen = formData.get("publicRegistrationOpen") === "on";
  const requireGuardianEmail = formData.get("requireGuardianEmail") === "on";
  const requireGuardianPhone = formData.get("requireGuardianPhone") === "on";
  const requireAllergiesNotes = formData.get("requireAllergiesNotes") === "on";
  const welcomeRaw = str(formData, "welcomeMessage").trim();
  const welcomeMessage = welcomeRaw.length > 0 ? welcomeRaw : null;

  await prisma.vbsSeason.update({
    where: { id: seasonId },
    data: { publicRegistrationOpen: publicOpen },
  });

  await prisma.publicRegistrationSettings.upsert({
    where: { seasonId },
    create: {
      seasonId,
      requireGuardianEmail,
      requireGuardianPhone,
      requireAllergiesNotes,
      welcomeMessage,
      registrationBackgroundImageUrl,
    },
    update: {
      requireGuardianEmail,
      requireGuardianPhone,
      requireAllergiesNotes,
      welcomeMessage,
      registrationBackgroundImageUrl,
    },
  });

  revalidatePath("/register");
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${seasonId}/public-settings`);

  return { ok: true, message: "Public registration settings saved." };
}
