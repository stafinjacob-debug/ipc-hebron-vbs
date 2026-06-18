/**
 * IPC Hebron VBS operates in US Central Time (CST/CDT).
 * Use these helpers for camp days, dashboards, and displayed timestamps.
 */
export const APP_TIMEZONE = "America/Chicago";

const WALL_CLOCK_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function partInt(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((p) => p.type === type)?.value;
  if (value == null) throw new Error(`Missing ${type} in formatted date`);
  return Number(value);
}

/** Convert a wall-clock time on a calendar day in app timezone to a UTC instant. */
function wallClockToUtc(
  dateKey: string,
  hour: number,
  minute: number,
  second: number,
  ms = 0,
): Date {
  const [y, mo, d] = dateKey.split("-").map(Number);
  if (!y || !mo || !d) throw new Error(`Invalid date key: ${dateKey}`);

  const targetMs = Date.UTC(y, mo - 1, d, hour, minute, second);
  let utcMs = targetMs;

  for (let i = 0; i < 4; i++) {
    const parts = WALL_CLOCK_FMT.formatToParts(new Date(utcMs));
    const representedMs = Date.UTC(
      partInt(parts, "year"),
      partInt(parts, "month") - 1,
      partInt(parts, "day"),
      partInt(parts, "hour"),
      partInt(parts, "minute"),
      partInt(parts, "second"),
    );
    utcMs -= representedMs - targetMs;
  }

  return new Date(utcMs + ms);
}

/** YYYY-MM-DD for "today" in app timezone. */
export function appTodayDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(now);
}

/** UTC instants covering a calendar day in app timezone. */
export function appDateBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: wallClockToUtc(dateKey, 0, 0, 0),
    end: wallClockToUtc(dateKey, 23, 59, 59, 999),
  };
}

/** Format a timestamp for display in app timezone. */
export function formatAppDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  }).format(d);
}

/** Format a date (no time) for display in app timezone. */
export function formatAppDate(
  value: Date | string | number,
  options?: Omit<Intl.DateTimeFormatOptions, "timeZone">,
): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    ...options,
  }).format(d);
}

/** Value for `<input type="datetime-local">` in app timezone. */
export function toDatetimeLocalValueInAppTz(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = WALL_CLOCK_FMT.formatToParts(d);
  const y = partInt(parts, "year");
  const mo = String(partInt(parts, "month")).padStart(2, "0");
  const day = String(partInt(parts, "day")).padStart(2, "0");
  const h = String(partInt(parts, "hour")).padStart(2, "0");
  const mi = String(partInt(parts, "minute")).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

/** Parse `<input type="datetime-local">` as app timezone wall clock. */
export function fromDatetimeLocalValueInAppTz(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const dateKey = `${m[1]}-${m[2]}-${m[3]}`;
  return wallClockToUtc(dateKey, Number(m[4]), Number(m[5]), 0);
}
