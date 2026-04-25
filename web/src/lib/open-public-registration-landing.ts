/**
 * Types + pure helpers for the public login landing (safe for Client Components).
 * Do not import Prisma or Node-only modules from this file.
 */

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

function ageRangeLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to age ${max}`;
  return null;
}

export function formatAgeRangeForCard(summary: OpenPublicRegistrationSummary): string | null {
  return ageRangeLabel(summary.minimumParticipantAgeYears, summary.maximumParticipantAgeYears);
}
