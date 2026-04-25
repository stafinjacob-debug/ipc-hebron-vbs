import { countActiveRegistrationsForSeason, isFormRegistrationOpen } from "@/lib/ensure-registration-form";
import type {
  OpenPublicRegistrationSummary,
  PublicRegistrationCardBadge,
} from "@/lib/open-public-registration-landing";
import { prisma } from "@/lib/prisma";

export type { OpenPublicRegistrationSummary, PublicRegistrationCardBadge } from "@/lib/open-public-registration-landing";

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

/** Server-only: loads open programs for the login landing. */
export async function listOpenPublicRegistrationSummaries(): Promise<OpenPublicRegistrationSummary[]> {
  const seasons = await prisma.vbsSeason.findMany({
    where: { publicRegistrationOpen: true },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: { publicRegistrationSettings: true, registrationForm: true },
  });

  const out: OpenPublicRegistrationSummary[] = [];
  for (const s of seasons) {
    const form = s.registrationForm;
    if (!form || form.status !== "PUBLISHED" || !isFormRegistrationOpen(form)) continue;

    const welcome = form.welcomeMessage ?? s.publicRegistrationSettings?.welcomeMessage ?? null;
    const teaser = welcome
      ? (welcome.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? null)
      : null;

    const registrationCount = await countActiveRegistrationsForSeason(s.id);
    const statusBadge = computeBadge({
      registrationCount,
      maxTotal: form.maxTotalRegistrations,
      waitlistEnabled: form.waitlistEnabled,
      closesAt: form.registrationClosesAt,
    });

    out.push({
      id: s.id,
      name: s.name,
      year: s.year,
      startDateIso: s.startDate.toISOString(),
      endDateIso: s.endDate.toISOString(),
      formTitle: form.title,
      teaser,
      theme: s.theme ?? null,
      minimumParticipantAgeYears: form.minimumParticipantAgeYears,
      maximumParticipantAgeYears: form.maximumParticipantAgeYears,
      registrationClosesAtIso: form.registrationClosesAt?.toISOString() ?? null,
      statusBadge,
      registrationCount,
      maxTotalRegistrations: form.maxTotalRegistrations,
      waitlistEnabled: form.waitlistEnabled,
    });
  }
  return out;
}
