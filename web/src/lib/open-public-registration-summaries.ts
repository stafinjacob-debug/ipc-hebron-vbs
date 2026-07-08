import { countActiveRegistrationsForSeason, isFormRegistrationOpen } from "@/lib/ensure-registration-form";
import type {
  OpenPublicRegistrationSummary,
  PublicRegistrationCardBadge,
} from "@/lib/open-public-registration-landing";
import { getPortalLookupPath, getPortalPublicPath } from "@/lib/portal-public-path";
import { prisma } from "@/lib/prisma";
import { calendarDateFromDate } from "@/lib/season-calendar-date";

export type { OpenPublicRegistrationSummary, PublicRegistrationCardBadge } from "@/lib/open-public-registration-landing";

type SeasonWithRelations = Awaited<
  ReturnType<
    typeof prisma.vbsSeason.findMany<{
      include: { publicRegistrationSettings: true; registrationForm: true };
    }>
  >
>[number];

function computeBadge(args: {
  registrationCount: number;
  maxTotal: number | null;
  waitlistEnabled: boolean;
  closesAt: Date | null;
}): PublicRegistrationCardBadge {
  const { registrationCount, maxTotal, waitlistEnabled, closesAt } = args;
  const atOrOverCap = maxTotal != null && maxTotal > 0 && registrationCount >= maxTotal;

  if (atOrOverCap) {
    return waitlistEnabled ? "waitlist" : "full";
  }

  if (closesAt) {
    const ms = closesAt.getTime() - Date.now();
    if (ms > 0 && ms <= 7 * 24 * 60 * 60 * 1000) return "closing_soon";
  }

  return "open";
}

function buildSummary(
  season: SeasonWithRelations,
  args: {
    statusBadge: PublicRegistrationCardBadge;
    publicRegistrationOpen: boolean;
    registrationCount: number;
    maxTotalRegistrations: number | null;
    waitlistEnabled: boolean;
    registrationClosesAtIso: string | null;
    minimumParticipantAgeYears: number | null;
    maximumParticipantAgeYears: number | null;
    formTitle: string | null;
    teaser: string | null;
    registrantLookupEnabled: boolean;
  },
): OpenPublicRegistrationSummary {
  return {
    id: season.id,
    name: season.name,
    year: season.year,
    registerPath: getPortalPublicPath(season),
    lookupPath: getPortalLookupPath(season),
    publicRegistrationSlug: season.publicRegistrationSlug,
    startDateIso: calendarDateFromDate(season.startDate),
    endDateIso: calendarDateFromDate(season.endDate),
    sessionTimeDescription: season.publicRegistrationSettings?.sessionTimeDescription?.trim() || null,
    helpContactEmail: season.publicRegistrationSettings?.helpContactEmail?.trim() || null,
    helpContactName: season.publicRegistrationSettings?.helpContactName?.trim() || null,
    formTitle: args.formTitle,
    teaser: args.teaser,
    theme: season.theme ?? null,
    minimumParticipantAgeYears: args.minimumParticipantAgeYears,
    maximumParticipantAgeYears: args.maximumParticipantAgeYears,
    participantAgeAsOfDateIso: season.participantAgeAsOfDate
      ? calendarDateFromDate(season.participantAgeAsOfDate)
      : null,
    registrationClosesAtIso: args.registrationClosesAtIso,
    statusBadge: args.statusBadge,
    registrationCount: args.registrationCount,
    maxTotalRegistrations: args.maxTotalRegistrations,
    waitlistEnabled: args.waitlistEnabled,
    publicRegistrationOpen: args.publicRegistrationOpen,
    registrantLookupEnabled: args.registrantLookupEnabled,
  };
}

async function buildClosedSummary(season: SeasonWithRelations): Promise<OpenPublicRegistrationSummary> {
  const form = season.registrationForm;
  const welcome = form?.welcomeMessage ?? season.publicRegistrationSettings?.welcomeMessage ?? null;

  return buildSummary(season, {
    statusBadge: "closed",
    publicRegistrationOpen: false,
    registrationCount: 0,
    maxTotalRegistrations: null,
    waitlistEnabled: false,
    registrationClosesAtIso: null,
    minimumParticipantAgeYears: form?.minimumParticipantAgeYears ?? null,
    maximumParticipantAgeYears: form?.maximumParticipantAgeYears ?? null,
    formTitle: form?.title ?? null,
    teaser: welcome?.trim() || null,
    registrantLookupEnabled: form?.registrantLookupEnabled ?? false,
  });
}

/** Server-only: loads programs for the login landing (open + registration-closed). */
export async function listOpenPublicRegistrationSummaries(): Promise<OpenPublicRegistrationSummary[]> {
  const seasons = await prisma.vbsSeason.findMany({
    where: { showOnPublicLanding: true },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: { publicRegistrationSettings: true, registrationForm: true },
  });

  const open: OpenPublicRegistrationSummary[] = [];
  const closed: OpenPublicRegistrationSummary[] = [];

  for (const season of seasons) {
    if (!season.publicRegistrationOpen) {
      closed.push(await buildClosedSummary(season));
      continue;
    }

    const form = season.registrationForm;
    if (!form || form.status !== "PUBLISHED" || !isFormRegistrationOpen(form)) continue;

    const welcome = form.welcomeMessage ?? season.publicRegistrationSettings?.welcomeMessage ?? null;
    const registrationCount = await countActiveRegistrationsForSeason(season.id);

    open.push(
      buildSummary(season, {
        statusBadge: computeBadge({
          registrationCount,
          maxTotal: form.maxTotalRegistrations,
          waitlistEnabled: form.waitlistEnabled,
          closesAt: form.registrationClosesAt,
        }),
        publicRegistrationOpen: true,
        registrationCount,
        maxTotalRegistrations: form.maxTotalRegistrations,
        waitlistEnabled: form.waitlistEnabled,
        registrationClosesAtIso: form.registrationClosesAt?.toISOString() ?? null,
        minimumParticipantAgeYears: form.minimumParticipantAgeYears,
        maximumParticipantAgeYears: form.maximumParticipantAgeYears,
        formTitle: form.title,
        teaser: welcome?.trim() || null,
        registrantLookupEnabled: form.registrantLookupEnabled,
      }),
    );
  }

  return [...open, ...closed];
}

/** True when at least one season allows family self-service lookup at /register/lookup. */
export async function hasPublicRegistrantLookupOpen(): Promise<boolean> {
  const count = await prisma.registrationForm.count({
    where: { registrantLookupEnabled: true },
  });
  return count > 0;
}
