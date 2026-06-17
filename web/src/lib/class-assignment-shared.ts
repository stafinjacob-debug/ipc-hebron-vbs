/**
 * Pure class/age helpers — safe to import from Client Components.
 * Do not import `prisma` or server-only modules here.
 */
import type {
  ClassroomAgeRule,
  ClassroomIntakeStatus,
  RegistrationStatus,
} from "@/generated/prisma";

/** Registrations that occupy a seat toward class capacity. */
export const SEAT_COUNT_STATUSES: RegistrationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "DRAFT",
  "CHECKED_OUT",
];

export type ClassroomForAutoAssign = {
  id: string;
  name: string;
  ageMin: number;
  ageMax: number;
  birthDateMin: Date | null;
  birthDateMax: Date | null;
  roundRobinGroupKey: string | null;
  /** When false, auto-assignment skips the ageMin/ageMax check. */
  useAgeRuleForAutoAssign: boolean;
  ageRule: ClassroomAgeRule;
  capacity: number;
  waitlistEnabled: boolean;
  intakeStatus: ClassroomIntakeStatus;
  isActive: boolean;
  sortOrder: number;
  /** When set with non-empty values, auto-assign also requires this per-child form answer. */
  matchFormFieldKey: string | null;
  matchFormFieldValues: string[];
};

/** Calendar date as YYYYMMDD for stable comparisons. */
export function calendarDateKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Format a stored date for `<input type="date">` (handles RSC-serialized strings). */
export function formatDateInputValue(
  value: Date | string | null | undefined,
): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? "";
  }
  const y = value.getFullYear();
  const mo = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function classroomUsesBirthDateRange(c: {
  birthDateMin: Date | null;
  birthDateMax: Date | null;
}): boolean {
  return c.birthDateMin != null && c.birthDateMax != null;
}

/** True when auto-assignment applies a birth-date or age filter (not an open class). */
export function classroomHasAutoAssignEligibilityFilter(c: {
  birthDateMin: Date | null;
  birthDateMax: Date | null;
  useAgeRuleForAutoAssign: boolean;
}): boolean {
  return classroomUsesBirthDateRange(c) || c.useAgeRuleForAutoAssign;
}

export function birthDateInEligibilityRange(
  dob: Date,
  min: Date,
  max: Date,
): boolean {
  const key = calendarDateKey(dob);
  return key >= calendarDateKey(min) && key <= calendarDateKey(max);
}

export function formatBirthDateRange(min: Date, max: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(min)} – ${fmt(max)}`;
}

export function roundRobinGroupId(c: ClassroomForAutoAssign): string {
  const key = c.roundRobinGroupKey?.trim();
  return key ? key : `__solo_${c.id}`;
}

export function childAgeYearsOnDate(dob: Date, asOf: Date): number {
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function ageForClassroomRule(
  dob: Date,
  rule: ClassroomAgeRule,
  registeredAt: Date,
  seasonEventStart: Date,
): number {
  const asOf = rule === "REGISTRATION_DATE" ? registeredAt : seasonEventStart;
  return childAgeYearsOnDate(dob, asOf);
}

export function ageRangeOverlaps(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
}

export function findInternalAgeGaps(
  ranges: { ageMin: number; ageMax: number; id: string }[],
): number[] {
  if (ranges.length === 0) return [];
  const lo = Math.min(...ranges.map((r) => r.ageMin));
  const hi = Math.max(...ranges.map((r) => r.ageMax));
  const missing: number[] = [];
  for (let age = lo; age <= hi; age++) {
    const covered = ranges.some((r) => age >= r.ageMin && age <= r.ageMax);
    if (!covered) missing.push(age);
  }
  return missing;
}

export function ageRuleLabel(rule: ClassroomAgeRule): string {
  return rule === "REGISTRATION_DATE"
    ? "Age on registration date"
    : "Age on event start date";
}

export type AutoAssignResult = {
  classroomId: string | null;
  matchedAge: number | null;
  /** When class is full but waitlist on, move registration to waitlist if it was PENDING/DRAFT. */
  nextStatus?: RegistrationStatus;
  note?: string;
};
