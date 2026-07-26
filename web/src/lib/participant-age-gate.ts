import {
  formatCalendarDateLong,
  parseCalendarDateInput,
} from "@/lib/season-calendar-date";
import {
  getVbsParticipantAgeAsOfDate,
  VBS_PARTICIPANT_MAX_YEARS,
  VBS_PARTICIPANT_MIN_YEARS,
} from "@/lib/vbs-participant-age-gate";

/** Parse a YYYY-MM-DD participant DOB or age-cutoff date (UTC calendar date). */
export function parseParticipantCalendarDate(ymd: string): Date {
  const d = parseCalendarDateInput(ymd);
  if (!d) throw new Error("Invalid date");
  return d;
}

/** Whole years between calendar dates stored at UTC midnight. */
export function participantAgeYearsOnDate(dob: Date, asOfDate: Date): number {
  let age = asOfDate.getUTCFullYear() - dob.getUTCFullYear();
  const m = asOfDate.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && asOfDate.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export type ParticipantAgeRules = {
  minimumYears: number;
  maximumYears: number;
  asOfDate: Date;
};

/** Legacy VBS defaults when a portal has no custom age configuration. */
export function defaultParticipantAgeRules(): ParticipantAgeRules {
  return {
    minimumYears: VBS_PARTICIPANT_MIN_YEARS,
    maximumYears: VBS_PARTICIPANT_MAX_YEARS,
    asOfDate: getVbsParticipantAgeAsOfDate(),
  };
}

export function formHasExplicitAgeLimits(
  minimumParticipantAgeYears?: number | null,
  maximumParticipantAgeYears?: number | null,
): boolean {
  return (
    (minimumParticipantAgeYears != null && minimumParticipantAgeYears >= 1) ||
    (maximumParticipantAgeYears != null && maximumParticipantAgeYears >= 1)
  );
}

/**
 * Resolve age limits for public registration.
 * - Explicit form min/max always win.
 * - When both are unset: VBS portals keep legacy 4–14 defaults; other program kinds have no age gate (`null`).
 */
export function resolveParticipantAgeRules(input: {
  minimumParticipantAgeYears?: number | null;
  maximumParticipantAgeYears?: number | null;
  participantAgeAsOfDate?: Date | null;
  seasonStartDate?: Date | null;
  /** When true and min/max are empty, use VBS 4–14 defaults. */
  applyVbsDefaultsWhenUnset?: boolean;
} = {}): ParticipantAgeRules | null {
  const defaults = defaultParticipantAgeRules();
  const hasMin =
    input.minimumParticipantAgeYears != null && input.minimumParticipantAgeYears >= 1;
  const hasMax =
    input.maximumParticipantAgeYears != null && input.maximumParticipantAgeYears >= 1;
  const asOfDate =
    input.participantAgeAsOfDate ?? input.seasonStartDate ?? defaults.asOfDate;

  if (!hasMin && !hasMax) {
    if (input.applyVbsDefaultsWhenUnset) {
      return { ...defaults, asOfDate };
    }
    return null;
  }

  return {
    minimumYears: hasMin ? Math.floor(input.minimumParticipantAgeYears!) : 0,
    maximumYears: hasMax ? Math.floor(input.maximumParticipantAgeYears!) : 150,
    asOfDate,
  };
}

export function formatParticipantAgeAsOfLabel(asOfDate: Date, locale?: string | string[]): string {
  const loc = Array.isArray(locale) ? locale[0] : locale;
  return formatCalendarDateLong(asOfDate, loc ?? "en-US");
}

export function validateParticipantAge(
  dob: Date,
  rules: ParticipantAgeRules,
  participantLabel: string,
  index: number,
): string | null {
  const age = participantAgeYearsOnDate(dob, rules.asOfDate);
  const cutoffLabel = formatParticipantAgeAsOfLabel(rules.asOfDate);
  const who = `${participantLabel} ${index + 1}`;
  if (age < rules.minimumYears) {
    return `${who}: Must be at least ${rules.minimumYears} years old as of ${cutoffLabel}.`;
  }
  if (age > rules.maximumYears) {
    return `${who}: Must be at most ${rules.maximumYears} years old as of ${cutoffLabel}.`;
  }
  return null;
}
