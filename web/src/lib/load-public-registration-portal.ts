import {
  ensureRegistrationFormForSeason,
  getEffectiveDefinition,
  isFormRegistrationOpen,
} from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { parsePublicRegistrationLayout } from "@/lib/public-registration-layout";
import { rulesFromDb } from "@/lib/public-registration";
import { calendarDateFromDate } from "@/lib/season-calendar-date";
import { parseWaiverMergeFieldKeysFromDb, parseWaiverSupplementalDefsFromDb } from "@/lib/waiver-merge-fields";
import type { PublicSeasonOption, PublicSeasonWaiverSnapshot } from "@/app/register/dynamic-registration-wizard";
import { getPortalLookupPath } from "@/lib/portal-public-path";
import { resolvePortalBranding, type PortalBranding } from "@/lib/portal-branding";

type SeasonInclude = {
  publicRegistrationSettings: true;
  registrationForm: true;
};

export type LoadPublicRegistrationPortalInput =
  | { mode: "legacy" }
  | { mode: "slug"; slug: string };

export type LoadedPublicRegistrationPortal = {
  seasons: PublicSeasonOption[];
  waiverBySeasonId: Record<string, PublicSeasonWaiverSnapshot>;
  branding: PortalBranding;
  dbUnavailable: boolean;
};

async function buildSeasonOption(
  s: Awaited<
    ReturnType<
      typeof prisma.vbsSeason.findMany<{ include: SeasonInclude }>
    >
  >[number],
): Promise<PublicSeasonOption | null> {
  const formRow = s.registrationForm ?? (await ensureRegistrationFormForSeason(s.id, s.name));
  if (formRow.status !== "PUBLISHED") return null;
  if (!isFormRegistrationOpen(formRow)) return null;

  const settings = s.publicRegistrationSettings;
  const branding = resolvePortalBranding(s, settings, {
    legacyVbsDefaults: !s.publicRegistrationSlug,
  });

  return {
    id: s.id,
    name: s.name,
    year: s.year,
    startDate: calendarDateFromDate(s.startDate),
    endDate: calendarDateFromDate(s.endDate),
    welcomeMessage: formRow.welcomeMessage ?? settings?.welcomeMessage ?? null,
    backgroundImageUrl: settings?.registrationBackgroundImageUrl ?? null,
    backgroundVideoUrl: settings?.registrationBackgroundVideoUrl ?? null,
    backgroundLayout: parsePublicRegistrationLayout(settings?.registrationBackgroundLayout),
    backgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(
      settings?.registrationBackgroundDimmingPercent,
    ),
    rules: rulesFromDb(settings),
    formTitle: formRow.title,
    definition: getEffectiveDefinition(formRow, false),
    minimumParticipantAgeYears: formRow.minimumParticipantAgeYears,
    maximumParticipantAgeYears: formRow.maximumParticipantAgeYears,
    participantAgeAsOfDateIso: s.participantAgeAsOfDate
      ? calendarDateFromDate(s.participantAgeAsOfDate)
      : calendarDateFromDate(s.startDate),
    participantSingularLabel: branding.participantSingularLabel,
    sessionPickerLabel: branding.sessionPickerLabel,
    classroomsEnabled: s.classroomsEnabled,
    stripeCheckoutEnabled: formRow.stripeCheckoutEnabled,
    stripeAmountCents: formRow.stripeAmountCents,
    stripePricingUnit: formRow.stripePricingUnit,
    stripeCapPaidChildrenAtThree: formRow.stripeCapPaidChildrenAtThree,
    stripePayLaterEnabled: formRow.stripePayLaterEnabled,
    stripePayLaterMessage: formRow.stripePayLaterMessage,
    stripeProcessingFeeMode: formRow.stripeProcessingFeeMode,
    stripeProductLabel: formRow.stripeProductLabel,
    stripeSkipWhenFieldKey: formRow.stripeSkipWhenFieldKey,
    stripeSkipWhenFieldValue: formRow.stripeSkipWhenFieldValue,
    registrantLookupEnabled: formRow.registrantLookupEnabled,
    sessionTimeDescription: settings?.sessionTimeDescription?.trim() || null,
    helpContactEmail: branding.contactEmail || null,
    contactFooterText: settings?.publicContactFooterText?.trim() || null,
    lookupPath: getPortalLookupPath(s),
    publicRegistrationSlug: s.publicRegistrationSlug,
    waiverEnabled: formRow.waiverEnabled,
    waiverTitle: formRow.waiverTitle,
    waiverDescription: formRow.waiverDescription,
    waiverBody: formRow.waiverBody,
    waiverMergeFieldKeys: parseWaiverMergeFieldKeysFromDb(formRow.waiverMergeFieldKeys),
    waiverSupplementalFields: parseWaiverSupplementalDefsFromDb(formRow.waiverSupplementalFields),
  };
}

export async function loadPublicRegistrationPortal(
  input: LoadPublicRegistrationPortalInput,
): Promise<LoadedPublicRegistrationPortal> {
  let dbUnavailable = false;
  let seasonsRaw: Awaited<
    ReturnType<typeof prisma.vbsSeason.findMany<{ include: SeasonInclude }>>
  > = [];

  try {
    if (input.mode === "legacy") {
      seasonsRaw = await prisma.vbsSeason.findMany({
        where: { publicRegistrationOpen: true, publicRegistrationSlug: null },
        orderBy: [{ year: "desc" }, { startDate: "desc" }],
        include: { publicRegistrationSettings: true, registrationForm: true },
      });
    } else {
      const row = await prisma.vbsSeason.findFirst({
        where: {
          publicRegistrationSlug: input.slug,
          publicRegistrationOpen: true,
        },
        include: { publicRegistrationSettings: true, registrationForm: true },
      });
      seasonsRaw = row ? [row] : [];
    }
  } catch (err) {
    dbUnavailable = true;
    console.error("[loadPublicRegistrationPortal] failed to load seasons", err);
  }

  const seasons: PublicSeasonOption[] = [];
  const waiverBySeasonId: Record<string, PublicSeasonWaiverSnapshot> = {};

  for (const s of seasonsRaw) {
    const option = await buildSeasonOption(s);
    if (!option) continue;
    seasons.push(option);
    const formRow = s.registrationForm ?? (await ensureRegistrationFormForSeason(s.id, s.name));
    waiverBySeasonId[s.id] = {
      enabled: formRow.waiverEnabled === true,
      title: formRow.waiverTitle,
      description: formRow.waiverDescription,
      body: formRow.waiverBody,
      mergeFieldKeys: parseWaiverMergeFieldKeysFromDb(formRow.waiverMergeFieldKeys),
      supplementalFields: parseWaiverSupplementalDefsFromDb(formRow.waiverSupplementalFields),
    };
  }

  const firstSeason = seasonsRaw[0] ?? null;
  const branding = firstSeason
    ? resolvePortalBranding(firstSeason, firstSeason.publicRegistrationSettings, {
        legacyVbsDefaults: input.mode === "legacy",
      })
    : resolvePortalBranding({ name: "Registration" }, null, { legacyVbsDefaults: input.mode === "legacy" });

  return { seasons, waiverBySeasonId, branding, dbUnavailable };
}
