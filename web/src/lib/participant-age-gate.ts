import { childAgeYearsOnDate } from "@/lib/class-assignment-shared";
import {
  getVbsParticipantAgeAsOfDate,
  VBS_PARTICIPANT_MAX_YEARS,
  VBS_PARTICIPANT_MIN_YEARS,
} from "@/lib/vbs-participant-age-gate";

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

export function resolveParticipantAgeRules(input: {
  minimumParticipantAgeYears?: number | null;
  maximumParticipantAgeYears?: number | null;
  participantAgeAsOfDate?: Date | null;
  seasonStartDate?: Date | null;
} = {}): ParticipantAgeRules {
  const defaults = defaultParticipantAgeRules();
  const min =
    input.minimumParticipantAgeYears != null && input.minimumParticipantAgeYears >= 1
      ? Math.floor(input.minimumParticipantAgeYears)
      : defaults.minimumYears;
  const max =
    input.maximumParticipantAgeYears != null && input.maximumParticipantAgeYears >= 1
      ? Math.floor(input.maximumParticipantAgeYears)
      : defaults.maximumYears;
  const asOfDate =
    input.participantAgeAsOfDate ??
    input.seasonStartDate ??
    defaults.asOfDate;
  return { minimumYears: min, maximumYears: max, asOfDate };
}

export function formatParticipantAgeAsOfLabel(asOfDate: Date, locale?: string | string[]): string {
  return asOfDate.toLocaleDateString(locale ?? "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function participantAgeYearsOnDate(dob: Date, asOfDate: Date): number {
  return childAgeYearsOnDate(dob, asOfDate);
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
