/** IPC Hebron VBS operates in US Central Time (CST/CDT). */
export const APP_TIMEZONE = "America/Chicago";

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
