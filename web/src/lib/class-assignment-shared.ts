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
  ageRule: ClassroomAgeRule;
  capacity: number;
  waitlistEnabled: boolean;
  intakeStatus: ClassroomIntakeStatus;
  isActive: boolean;
  sortOrder: number;
};

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
