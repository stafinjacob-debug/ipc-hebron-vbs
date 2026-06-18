/**
 * Types + pure helpers for the public login landing (safe for Client Components).
 * Do not import Prisma or Node-only modules from this file.
 */

import {
  formatParticipantAgeAsOfLabel,
  resolveParticipantAgeRules,
} from "@/lib/participant-age-gate";
import { parseCalendarDateInput } from "@/lib/season-calendar-date";

/** Visual status for the public landing card (UX scan). */
export type PublicRegistrationCardBadge = "open" | "closing_soon" | "waitlist" | "full";

/** Serialized season row for the login landing (built on the server). */
export type OpenPublicRegistrationSummary = {
  id: string;
  name: string;
  year: number;
  startDateIso: string;
  endDateIso: string;
  /** Optional line shown under VBS dates (e.g. daily hours). */
  sessionTimeDescription: string | null;
  /** Optional help email shown on cards / public pages. */
  helpContactEmail: string | null;
  formTitle: string | null;
  teaser: string | null;
  theme: string | null;
  minimumParticipantAgeYears: number | null;
  maximumParticipantAgeYears: number | null;
  /** Season-level age cutoff; empty uses event start date. */
  participantAgeAsOfDateIso: string | null;
  registrationClosesAtIso: string | null;
  statusBadge: PublicRegistrationCardBadge;
  registrationCount: number;
  maxTotalRegistrations: number | null;
  waitlistEnabled: boolean;
  /** Public signup path (e.g. /register or /register/soccer). */
  registerPath: string;
  publicRegistrationSlug: string | null;
};

export function formatAgeRangeForCard(summary: OpenPublicRegistrationSummary): string | null {
  const seasonStart = parseCalendarDateInput(summary.startDateIso);
  const participantAsOf = summary.participantAgeAsOfDateIso
    ? parseCalendarDateInput(summary.participantAgeAsOfDateIso)
    : null;
  const rules = resolveParticipantAgeRules({
    minimumParticipantAgeYears: summary.minimumParticipantAgeYears,
    maximumParticipantAgeYears: summary.maximumParticipantAgeYears,
    participantAgeAsOfDate: participantAsOf,
    seasonStartDate: seasonStart,
  });
  return `Ages ${rules.minimumYears}–${rules.maximumYears} (as of ${formatParticipantAgeAsOfLabel(rules.asOfDate)})`;
}
