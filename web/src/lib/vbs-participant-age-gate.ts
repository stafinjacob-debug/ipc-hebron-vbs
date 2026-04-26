import { childAgeYearsOnDate } from "@/lib/class-assignment-shared";

/** Inclusive whole-year age range for VBS participants (public + staff intake). */
export const VBS_PARTICIPANT_MIN_YEARS = 4;
export const VBS_PARTICIPANT_MAX_YEARS = 14;

/** Age is measured in whole years as of this calendar date (local). */
export function getVbsParticipantAgeAsOfDate(): Date {
  return new Date(2025, 8, 1);
}

export function formatVbsParticipantAgeAsOfLabel(locale?: string | string[]): string {
  return getVbsParticipantAgeAsOfDate().toLocaleDateString(locale ?? "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function publicVbsParticipantAgeYearsOnGateDate(dob: Date): number {
  return childAgeYearsOnDate(dob, getVbsParticipantAgeAsOfDate());
}
