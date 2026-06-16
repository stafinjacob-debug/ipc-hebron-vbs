"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { validatePortalSlug } from "@/lib/portal-public-path";
import {
  createFormDefinitionForProgramKind,
  defaultFormTitleForProgramKind,
  definitionToJson,
} from "@/lib/registration-form-definition";
import type { ProgramKind } from "@/generated/prisma";
import { parseCalendarDateInput } from "@/lib/season-calendar-date";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateProgramState = {
  ok: boolean;
  message: string;
  seasonId?: string;
};

function parseProgramKind(raw: string): ProgramKind {
  const v = raw.trim().toUpperCase();
  if (v === "SPORTS" || v === "YOUTH" || v === "GENERAL" || v === "VBS") return v;
  return "GENERAL";
}

export async function createProgramAction(
  _prev: CreateProgramState | null,
  formData: FormData,
): Promise<CreateProgramState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to create programs." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const theme = String(formData.get("theme") ?? "").trim() || null;
  const slugRaw = String(formData.get("publicRegistrationSlug") ?? "").trim();
  const programKind = parseProgramKind(String(formData.get("programKind") ?? "GENERAL"));
  const startDate = parseCalendarDateInput(String(formData.get("startDate") ?? ""));
  const endDate = parseCalendarDateInput(String(formData.get("endDate") ?? ""));
  const cloneFromSeasonId = String(formData.get("cloneFromSeasonId") ?? "").trim() || null;

  if (!name) return { ok: false, message: "Program name is required." };
  const year = Number.parseInt(yearRaw, 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { ok: false, message: "Enter a valid year." };
  }
  if (!startDate || !endDate) {
    return { ok: false, message: "Start and end dates are required." };
  }
  if (endDate.getTime() < startDate.getTime()) {
    return { ok: false, message: "End date must be on or after the start date." };
  }

  const slugResult = validatePortalSlug(slugRaw);
  if (!slugResult.ok) return { ok: false, message: slugResult.message };

  const existingSlug = await prisma.vbsSeason.findFirst({
    where: { publicRegistrationSlug: slugResult.slug },
    select: { id: true },
  });
  if (existingSlug) {
    return { ok: false, message: "That public URL slug is already in use." };
  }

  const classroomsEnabled = programKind === "VBS";
  const checkInEnabled = programKind === "VBS";
  const badgesEnabled = programKind === "VBS";

  const season = await prisma.vbsSeason.create({
    data: {
      name,
      year,
      theme,
      startDate,
      endDate,
      isActive: false,
      publicRegistrationOpen: false,
      publicRegistrationSlug: slugResult.slug,
      programKind,
      classroomsEnabled,
      checkInEnabled,
      badgesEnabled,
      multiDayCheckInEnabled: programKind === "VBS",
    },
  });

  await prisma.publicRegistrationSettings.create({
    data: {
      seasonId: season.id,
      publicHeaderLabel: name,
      publicPageTitle: `${name} | Registration`,
      publicPageDescription: `Register for ${name}`,
      participantSectionLabel: programKind === "SPORTS" ? "Players" : "Participants",
      participantSingularLabel: programKind === "SPORTS" ? "Player" : "Participant",
      contactSectionLabel: programKind === "SPORTS" ? "Contact person" : "Contact information",
      sessionPickerLabel: "Session",
    },
  });

  if (cloneFromSeasonId) {
    const srcForm = await prisma.registrationForm.findUnique({
      where: { seasonId: cloneFromSeasonId },
    });
    const srcSettings = await prisma.publicRegistrationSettings.findUnique({
      where: { seasonId: cloneFromSeasonId },
    });
    if (srcForm) {
      const def = createFormDefinitionForProgramKind(programKind);
      await prisma.registrationForm.create({
        data: {
          seasonId: season.id,
          title: defaultFormTitleForProgramKind(programKind, name),
          welcomeMessage: srcForm.welcomeMessage,
          confirmationMessage: srcForm.confirmationMessage,
          status: "DRAFT",
          draftDefinitionJson: srcForm.draftDefinitionJson ?? definitionToJson(def),
          publishedDefinitionJson: null,
          stripeCheckoutEnabled: srcForm.stripeCheckoutEnabled,
          autoApproveWhenClassAssignedAndPaid: srcForm.autoApproveWhenClassAssignedAndPaid,
          stripeAmountCents: srcForm.stripeAmountCents,
          stripePricingUnit: srcForm.stripePricingUnit,
          stripeCapPaidChildrenAtThree: srcForm.stripeCapPaidChildrenAtThree,
          stripePayLaterEnabled: srcForm.stripePayLaterEnabled,
          stripeProcessingFeeMode: srcForm.stripeProcessingFeeMode,
        },
      });
    }
    if (srcSettings) {
      await prisma.publicRegistrationSettings.update({
        where: { seasonId: season.id },
        data: {
          registrationBackgroundImageUrl: srcSettings.registrationBackgroundImageUrl,
          registrationBackgroundVideoUrl: srcSettings.registrationBackgroundVideoUrl,
          registrationBackgroundDimmingPercent: srcSettings.registrationBackgroundDimmingPercent,
          registrationBackgroundLayout: srcSettings.registrationBackgroundLayout,
        },
      });
    }
  } else {
    const def = createFormDefinitionForProgramKind(programKind);
    const json = definitionToJson(def);
    await prisma.registrationForm.create({
      data: {
        seasonId: season.id,
        title: defaultFormTitleForProgramKind(programKind, name),
        status: "DRAFT",
        draftDefinitionJson: json,
        publishedDefinitionJson: null,
      },
    });
  }

  revalidatePath("/seasons");
  revalidatePath("/registrations/forms");
  redirect(`/registrations/forms/${season.id}`);
}
