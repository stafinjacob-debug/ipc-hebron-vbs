/**
 * Types + pure helpers for the public login landing (safe for Client Components).
 * Do not import Prisma or Node-only modules from this file.
 */

import {
  formatVbsParticipantAgeAsOfLabel,
  VBS_PARTICIPANT_MAX_YEARS,
  VBS_PARTICIPANT_MIN_YEARS,
} from "@/lib/vbs-participant-age-gate";

/** Visual status for the public landing card (UX scan). */
export type PublicRegistrationCardBadge = "open" | "closing_soon" | "waitlist" | "full";

/** Serialized season row for the login landing (built on the server). */
export type OpenPublicRegistrationSummary = {
  id: string;
  name: string;
  year: number;
  startDateIso: string;
  endDateIso: string;
  formTitle: string | null;
  teaser: string | null;
  theme: string | null;
  minimumParticipantAgeYears: number | null;
  maximumParticipantAgeYears: number | null;
  registrationClosesAtIso: string | null;
  statusBadge: PublicRegistrationCardBadge;
  registrationCount: number;
  maxTotalRegistrations: number | null;
  waitlistEnabled: boolean;
};

export function formatAgeRangeForCard(_summary: OpenPublicRegistrationSummary): string | null {
  return `Ages ${VBS_PARTICIPANT_MIN_YEARS}–${VBS_PARTICIPANT_MAX_YEARS} (as of ${formatVbsParticipantAgeAsOfLabel()})`;
}
