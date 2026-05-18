/**
 * VBS season start/end are calendar dates (no time-of-day), stored at UTC midnight.
 * Always format and parse with UTC so admin settings match public registration pages.
 */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCalendarDateInput(value: string): Date | null {
  const trimmed = value.trim();
  const m = YMD_RE.exec(trimmed);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `YYYY-MM-DD` for &lt;input type="date"&gt; from a DB DateTime. */
export function formatCalendarDateInputValue(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Serialize a season boundary for the client (date-only string). */
export function calendarDateFromDate(date: Date): string {
  return formatCalendarDateInputValue(date);
}

/** Normalize ISO instant or `YYYY-MM-DD` to a calendar date key. */
export function normalizeCalendarDateInput(isoOrYmd: string | Date): string {
  if (typeof isoOrYmd === "string") {
    if (YMD_RE.test(isoOrYmd)) return isoOrYmd;
    return formatCalendarDateInputValue(new Date(isoOrYmd));
  }
  return formatCalendarDateInputValue(isoOrYmd);
}

export function formatCalendarDateLong(
  isoOrYmd: string | Date,
  locale = "en-US",
  options?: Omit<Intl.DateTimeFormatOptions, "timeZone">,
): string {
  const ymd = normalizeCalendarDateInput(isoOrYmd);
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(dt);
}

export function formatSeasonDateRange(
  start: string | Date,
  end: string | Date,
  locale = "en-US",
): string {
  return `${formatCalendarDateLong(start, locale)} – ${formatCalendarDateLong(end, locale)}`;
}

/** e.g. "June 18 – 21, 2026" when start and end share month/year. */
export function formatSeasonDateRangeCompact(
  start: string | Date,
  end: string | Date,
  locale = "en-US",
): string {
  const startYmd = normalizeCalendarDateInput(start);
  const endYmd = normalizeCalendarDateInput(end);
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  const startDt = new Date(Date.UTC(sy, sm - 1, sd));
  const endDt = new Date(Date.UTC(ey, em - 1, ed));

  if (sy === ey && sm === em) {
    const monthDay = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", timeZone: "UTC" });
    const endFull = new Intl.DateTimeFormat(locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    return `${monthDay.format(startDt)} – ${endFull.format(endDt)}`;
  }
  return formatSeasonDateRange(start, end, locale);
}
