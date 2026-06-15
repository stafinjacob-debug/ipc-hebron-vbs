import type { RegistrationStatus } from "@/generated/prisma";

const REGISTRATION_STATUSES = new Set<RegistrationStatus>([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "WAITLIST",
  "DRAFT",
  "CHECKED_OUT",
]);

export function queryParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseRegistrationStatusFilter(raw: string): RegistrationStatus | null {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) return null;
  return REGISTRATION_STATUSES.has(normalized as RegistrationStatus)
    ? (normalized as RegistrationStatus)
    : null;
}

export function hasActiveRegistrationListFilters(input: {
  q: string;
  seasonId: string;
  status: RegistrationStatus | null;
  classroom: string;
  payment: string;
  dynamicFilters: Array<{ key: string; value: string }>;
}): boolean {
  return Boolean(
    input.q ||
      input.seasonId ||
      input.status ||
      input.classroom ||
      input.payment ||
      input.dynamicFilters.length > 0,
  );
}
