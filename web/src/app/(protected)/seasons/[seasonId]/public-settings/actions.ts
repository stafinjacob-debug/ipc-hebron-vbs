"use server";

import { auth } from "@/auth";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
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
import { parseCalendarDateInput } from "@/lib/season-calendar-date";

export type SavePublicSettingsState = {
  ok: boolean;
  message: string;
};

function str(formData: FormData, k: string) {
  const v = formData.get(k);
  return typeof v === "string" ? v : "";
}

function normalizeOptionalEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
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
  const registrantLookupEnabled = formData.get("registrantLookupEnabled") === "on";
  const requireGuardianEmail = formData.get("requireGuardianEmail") === "on";
  const requireGuardianPhone = formData.get("requireGuardianPhone") === "on";
  const requireAllergiesNotes = formData.get("requireAllergiesNotes") === "on";
  const welcomeRaw = str(formData, "welcomeMessage").trim();
  const welcomeMessage = welcomeRaw.length > 0 ? welcomeRaw : null;
  const sessionTimeRaw = str(formData, "sessionTimeDescription").trim();
  const sessionTimeDescription = sessionTimeRaw.length > 0 ? sessionTimeRaw : null;
  const helpEmailRaw = str(formData, "helpContactEmail");
  const helpContactEmail = normalizeOptionalEmail(helpEmailRaw);
  if (helpEmailRaw.trim() && !helpContactEmail) {
    return { ok: false, message: "Help email must be a valid email address." };
  }
  const registrationBackgroundDimmingPercent = clampRegistrationBackgroundDimmingPercent(
    str(formData, "registrationBackgroundDimmingPercent"),
  );
  const startStr = str(formData, "seasonStartDate").trim();
  const endStr = str(formData, "seasonEndDate").trim();
  /** Form workspace “Design” tab saves public settings without season date fields — keep existing VBS dates. */
  const omitSeasonDates = !startStr && !endStr;
  const seasonStartDate = omitSeasonDates ? season.startDate : parseCalendarDateInput(startStr);
  const seasonEndDate = omitSeasonDates ? season.endDate : parseCalendarDateInput(endStr);
  if (!seasonStartDate || !seasonEndDate) {
    return { ok: false, message: "Provide valid season start and end dates." };
  }
  if (seasonEndDate.getTime() < seasonStartDate.getTime()) {
    return { ok: false, message: "Season end date must be on or after the start date." };
  }

  const formRow = await ensureRegistrationFormForSeason(seasonId, season.name);

  await prisma.$transaction([
    prisma.vbsSeason.update({
      where: { id: seasonId },
      data: {
        publicRegistrationOpen: publicOpen,
        startDate: seasonStartDate,
        endDate: seasonEndDate,
      },
    }),
    prisma.registrationForm.update({
      where: { id: formRow.id },
      data: { registrantLookupEnabled },
    }),
  ]);

  await prisma.publicRegistrationSettings.upsert({
    where: { seasonId },
    create: {
      seasonId,
      requireGuardianEmail,
      requireGuardianPhone,
      requireAllergiesNotes,
      welcomeMessage,
      sessionTimeDescription,
      helpContactEmail,
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
      sessionTimeDescription,
      helpContactEmail,
      registrationBackgroundImageUrl,
      registrationBackgroundVideoUrl,
      registrationBackgroundDimmingPercent,
      registrationBackgroundLayout,
    },
  });

  revalidatePath("/register");
  revalidatePath("/register/lookup");
  if (season.publicRegistrationSlug) {
    revalidatePath(`/register/${season.publicRegistrationSlug}`);
    revalidatePath(`/register/${season.publicRegistrationSlug}/lookup`);
  }
  revalidatePath("/seasons");
  revalidatePath("/login");
  revalidatePath(`/seasons/${seasonId}/public-settings`);
  revalidatePath("/registrations/forms");
  revalidatePath(`/registrations/form-workspace/${seasonId}`);
  revalidatePath(`/registrations/forms/${seasonId}/settings`);

  let message = "Public registration settings saved.";
  if (!publicOpen) {
    message =
      "Public registration settings saved. Registration is now closed — families will see a closed message on /register.";
    if (registrantLookupEnabled) {
      message += " Registration lookup remains open at /register/lookup.";
    }
  }

  return { ok: true, message };
}
