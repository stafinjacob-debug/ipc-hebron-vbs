"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { parsePublicRegistrationLayout } from "@/lib/public-registration-layout";
import {
  deleteLocalRegistrationBackground,
  uploadRegistrationBackgroundImage,
  uploadRegistrationBackgroundVideo,
} from "@/lib/registration-background-upload";
import { revalidatePath } from "next/cache";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";

export type SavePublicSettingsState = {
  ok: boolean;
  message: string;
};

function str(formData: FormData, k: string) {
  const v = formData.get(k);
  return typeof v === "string" ? v : "";
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
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
  let registrationBackgroundVideoUrl =
    existing?.registrationBackgroundVideoUrl ?? null;

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

  if (formData.get("removeBackgroundVideo") === "on") {
    await deleteLocalRegistrationBackground(registrationBackgroundVideoUrl);
    registrationBackgroundVideoUrl = null;
  } else {
    const vfile = formData.get("backgroundVideo");
    if (vfile instanceof File && vfile.size > 0) {
      const uploaded = await uploadRegistrationBackgroundVideo(vfile, seasonId);
      if (!uploaded.ok) {
        return { ok: false, message: uploaded.error };
      }
      await deleteLocalRegistrationBackground(registrationBackgroundVideoUrl);
      registrationBackgroundVideoUrl = uploaded.url;
    }
  }

  const registrationBackgroundLayout = parsePublicRegistrationLayout(
    str(formData, "registrationBackgroundLayout"),
  );

  const publicOpen = formData.get("publicRegistrationOpen") === "on";
  const requireGuardianEmail = formData.get("requireGuardianEmail") === "on";
  const requireGuardianPhone = formData.get("requireGuardianPhone") === "on";
  const requireAllergiesNotes = formData.get("requireAllergiesNotes") === "on";
  const welcomeRaw = str(formData, "welcomeMessage").trim();
  const welcomeMessage = welcomeRaw.length > 0 ? welcomeRaw : null;
  const registrationBackgroundDimmingPercent = clampRegistrationBackgroundDimmingPercent(
    str(formData, "registrationBackgroundDimmingPercent"),
  );
  const startStr = str(formData, "seasonStartDate").trim();
  const endStr = str(formData, "seasonEndDate").trim();
  /** Form workspace “Design” tab saves public settings without season date fields — keep existing VBS dates. */
  const omitSeasonDates = !startStr && !endStr;
  const seasonStartDate = omitSeasonDates ? season.startDate : parseDateInput(startStr);
  const seasonEndDate = omitSeasonDates ? season.endDate : parseDateInput(endStr);
  if (!seasonStartDate || !seasonEndDate) {
    return { ok: false, message: "Provide valid season start and end dates." };
  }
  if (seasonEndDate.getTime() < seasonStartDate.getTime()) {
    return { ok: false, message: "Season end date must be on or after the start date." };
  }

  await prisma.vbsSeason.update({
    where: { id: seasonId },
    data: {
      publicRegistrationOpen: publicOpen,
      startDate: seasonStartDate,
      endDate: seasonEndDate,
    },
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
      registrationBackgroundVideoUrl,
      registrationBackgroundDimmingPercent,
      registrationBackgroundLayout,
    },
    update: {
      requireGuardianEmail,
      requireGuardianPhone,
      requireAllergiesNotes,
      welcomeMessage,
      registrationBackgroundImageUrl,
      registrationBackgroundVideoUrl,
      registrationBackgroundDimmingPercent,
      registrationBackgroundLayout,
    },
  });

  revalidatePath("/register");
  revalidatePath("/seasons");
  revalidatePath("/login");
  revalidatePath(`/seasons/${seasonId}/public-settings`);
  revalidatePath("/registrations/forms");
  revalidatePath(`/registrations/form-workspace/${seasonId}`);

  return { ok: true, message: "Public registration settings saved." };
}
