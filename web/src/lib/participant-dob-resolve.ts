import { parseParticipantCalendarDate } from "@/lib/participant-age-gate";

/** Estimated Sept 1 birth dates for fall 2026 grade placement (internal storage only). */
const GRADE_FALL_2026_DOB: Record<string, string> = {
  "5th": "2016-09-01",
  "6th": "2015-09-01",
  "7th": "2014-09-01",
  "8th": "2013-09-01",
  "9th": "2012-09-01",
  "10th": "2011-09-01",
  "11th": "2010-09-01",
  "12th": "2009-09-01",
};

/**
 * Resolve a participant DOB for database storage when the public form collects grade instead of birth date.
 */
export function resolveParticipantDateOfBirth(args: {
  childDateOfBirth?: string;
  custom?: Record<string, string | boolean | number | null>;
  seasonStartDate: Date;
}): Date {
  const raw = args.childDateOfBirth?.trim();
  if (raw) return parseParticipantCalendarDate(raw);

  for (const key of ["gradeFall2026", "gradeLevel", "grade"]) {
    const v = args.custom?.[key];
    if (typeof v === "string") {
      const mapped = GRADE_FALL_2026_DOB[v.trim()];
      if (mapped) return parseParticipantCalendarDate(mapped);
    }
  }

  const fallback = new Date(args.seasonStartDate);
  fallback.setUTCFullYear(fallback.getUTCFullYear() - 10);
  return fallback;
}
