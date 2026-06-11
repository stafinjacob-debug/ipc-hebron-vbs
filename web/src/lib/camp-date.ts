import {
  formatCalendarDateInputValue,
  formatCalendarDateLong,
  normalizeCalendarDateInput,
  parseCalendarDateInput,
} from "@/lib/season-calendar-date";

export type CampDateOption = {
  key: string;
  label: string;
  isPast: boolean;
  isToday: boolean;
};

/** Local calendar date key (YYYY-MM-DD) for "today" at the check-in desk. */
export function localTodayCampDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function campDateKeyToUtcDate(key: string): Date {
  const parsed = parseCalendarDateInput(key);
  if (!parsed) throw new Error(`Invalid camp date: ${key}`);
  return parsed;
}

export function campDateFromUtcDate(date: Date): string {
  return formatCalendarDateInputValue(date);
}

export function isPastCampDate(key: string, now = new Date()): boolean {
  return key < localTodayCampDateKey(now);
}

export function isTodayCampDate(key: string, now = new Date()): boolean {
  return key === localTodayCampDateKey(now);
}

export function listCampDateKeys(startDate: Date, endDate: Date): string[] {
  const startKey = normalizeCalendarDateInput(startDate);
  const endKey = normalizeCalendarDateInput(endDate);
  const keys: string[] = [];

  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (cursor.getTime() <= end.getTime()) {
    keys.push(formatCalendarDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

export function buildCampDateOptions(
  startDate: Date,
  endDate: Date,
  now = new Date(),
): CampDateOption[] {
  const today = localTodayCampDateKey(now);
  return listCampDateKeys(startDate, endDate).map((key) => ({
    key,
    label: formatCalendarDateLong(key, "en-US", { weekday: "short" }),
    isPast: key < today,
    isToday: key === today,
  }));
}

export function resolveCampDateKey(
  startDate: Date,
  endDate: Date,
  requestedKey: string | null | undefined,
  now = new Date(),
): { key: string; error?: string } {
  const allowed = new Set(listCampDateKeys(startDate, endDate));
  const today = localTodayCampDateKey(now);
  const fallback = allowed.has(today)
    ? today
    : [...allowed].reverse().find((k) => k <= today) ?? [...allowed][0];

  if (!fallback) {
    return { key: today, error: "Season has no camp dates configured." };
  }

  const key = (requestedKey?.trim() || fallback).slice(0, 10);
  if (!allowed.has(key)) {
    return { key: fallback, error: "That camp day is outside this season." };
  }

  return { key };
}

export function formatCampDateForExport(key: string): string {
  return formatCalendarDateLong(key);
}
