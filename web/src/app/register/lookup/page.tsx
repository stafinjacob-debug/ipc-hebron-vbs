import type { Metadata } from "next";
import { ensureRegistrationFormForSeason, isFormRegistrationOpen } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { calendarDateFromDate } from "@/lib/season-calendar-date";
import {
  RegistrantLookupPageShell,
  type RegistrantLookupPageDisplay,
} from "./registrant-lookup-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find your registration | IPC Hebron VBS",
  description: "Look up or update your Vacation Bible School registration",
};

const CHURCH_DISPLAY_NAME = "IPC Hebron";
const DEFAULT_HELP_EMAIL = "vbs@ipchouston.com";

function fallbackDisplay(): RegistrantLookupPageDisplay {
  return {
    churchDisplayName: CHURCH_DISPLAY_NAME,
    headerLabel: `${CHURCH_DISPLAY_NAME} VBS`,
    contactEmail:
      process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ||
      process.env.VBS_HELP_EMAIL?.trim() ||
      DEFAULT_HELP_EMAIL,
    contactPhone: process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "",
    formTitle: null,
    seasonName: null,
    seasonId: null,
    registerPath: "/register",
    welcomeMessage: null,
    startDate: null,
    endDate: null,
    sessionTimeDescription: null,
    helpContactEmail: null,
    backgroundImageUrl: null,
    backgroundVideoUrl: null,
    backgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(undefined),
    lookupEnabled: false,
    registrationOpen: false,
  };
}

export default async function RegistrantLookupPage() {
  let display = fallbackDisplay();

  try {
    const seasons = await prisma.vbsSeason.findMany({
      where: {
        registrationForm: { is: { registrantLookupEnabled: true } },
      },
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      include: { publicRegistrationSettings: true, registrationForm: true },
    });

    const season = seasons[0] ?? null;

    if (season) {
      const formRow =
        season.registrationForm ?? (await ensureRegistrationFormForSeason(season.id, season.name));
      const settings = season.publicRegistrationSettings;
      const registrationOpen =
        season.publicRegistrationOpen &&
        formRow.status === "PUBLISHED" &&
        isFormRegistrationOpen(formRow);

      display = {
        churchDisplayName: CHURCH_DISPLAY_NAME,
        headerLabel: `${CHURCH_DISPLAY_NAME} VBS`,
        contactEmail:
          process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ||
          process.env.VBS_HELP_EMAIL?.trim() ||
          DEFAULT_HELP_EMAIL,
        contactPhone: process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "",
        formTitle: formRow.title,
        seasonName: season.name,
        seasonId: null,
        registerPath: "/register",
        welcomeMessage: formRow.welcomeMessage ?? settings?.welcomeMessage ?? null,
        startDate: calendarDateFromDate(season.startDate),
        endDate: calendarDateFromDate(season.endDate),
        sessionTimeDescription: settings?.sessionTimeDescription?.trim() || null,
        helpContactEmail:
          settings?.helpContactEmail?.trim() ||
          process.env.VBS_HELP_EMAIL?.trim() ||
          DEFAULT_HELP_EMAIL,
        backgroundImageUrl: settings?.registrationBackgroundImageUrl ?? null,
        backgroundVideoUrl: settings?.registrationBackgroundVideoUrl ?? null,
        backgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(
          settings?.registrationBackgroundDimmingPercent,
        ),
        lookupEnabled: true,
        registrationOpen,
      };
    }
  } catch (err) {
    console.error("[register/lookup] failed to load season display", err);
  }

  return <RegistrantLookupPageShell display={display} />;
}
