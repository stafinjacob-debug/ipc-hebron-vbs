import type { Metadata } from "next";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
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
    contactEmail:
      process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ||
      process.env.VBS_HELP_EMAIL?.trim() ||
      DEFAULT_HELP_EMAIL,
    contactPhone: process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "",
    formTitle: null,
    seasonName: null,
    welcomeMessage: null,
    startDate: null,
    endDate: null,
    sessionTimeDescription: null,
    helpContactEmail: null,
    backgroundImageUrl: null,
    backgroundVideoUrl: null,
    backgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(undefined),
  };
}

export default async function RegistrantLookupPage() {
  let display = fallbackDisplay();

  try {
    const seasons = await prisma.vbsSeason.findMany({
      where: {
        OR: [
          { publicRegistrationOpen: true },
          { registrationForm: { is: { registrantLookupEnabled: true } } },
        ],
      },
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      include: { publicRegistrationSettings: true, registrationForm: true },
    });

    const season =
      seasons.find((s) => s.registrationForm?.registrantLookupEnabled) ?? seasons[0] ?? null;

    if (season) {
      const formRow =
        season.registrationForm ?? (await ensureRegistrationFormForSeason(season.id, season.name));
      const settings = season.publicRegistrationSettings;

      display = {
        churchDisplayName: CHURCH_DISPLAY_NAME,
        contactEmail:
          process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ||
          process.env.VBS_HELP_EMAIL?.trim() ||
          DEFAULT_HELP_EMAIL,
        contactPhone: process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "",
        formTitle: formRow.title,
        seasonName: season.name,
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
      };
    }
  } catch (err) {
    console.error("[register/lookup] failed to load season display", err);
  }

  return <RegistrantLookupPageShell display={display} />;
}
