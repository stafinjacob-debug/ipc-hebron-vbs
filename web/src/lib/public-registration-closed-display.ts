import {
  ensureRegistrationFormForSeason,
  isFormRegistrationOpen,
} from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";

export type PublicRegistrationClosedDisplay = {
  headline: string;
  message: string;
  registrantLookupEnabled: boolean;
  seasonName: string | null;
};

/** Message for /register when no signup seasons are available. */
export async function resolvePublicRegistrationClosedDisplay(): Promise<PublicRegistrationClosedDisplay | null> {
  const season = await prisma.vbsSeason.findFirst({
    orderBy: [{ isActive: "desc" }, { year: "desc" }, { startDate: "desc" }],
    include: { registrationForm: true },
  });
  if (!season) return null;

  const form =
    season.registrationForm ?? (await ensureRegistrationFormForSeason(season.id, season.name));

  if (!season.publicRegistrationOpen) {
    return {
      headline: "Registration is now closed",
      message: `We are no longer accepting new signups for ${season.name}. If you already registered, you may still be able to look up or update your registration below.`,
      registrantLookupEnabled: form.registrantLookupEnabled,
      seasonName: season.name,
    };
  }

  if (form.status !== "PUBLISHED") {
    return {
      headline: "Registration is not open yet",
      message: `${season.name} registration has not been published yet. Please check back soon or contact the church office.`,
      registrantLookupEnabled: form.registrantLookupEnabled,
      seasonName: season.name,
    };
  }

  if (!isFormRegistrationOpen(form)) {
    return {
      headline: "Registration is now closed",
      message: `The online registration window for ${season.name} has ended. If you already registered, you may still be able to look up or update your registration below.`,
      registrantLookupEnabled: form.registrantLookupEnabled,
      seasonName: season.name,
    };
  }

  return {
    headline: "Online registration isn't open right now",
    message: "Please check back soon or contact the church office for assistance.",
    registrantLookupEnabled: form.registrantLookupEnabled,
    seasonName: season.name,
  };
}
