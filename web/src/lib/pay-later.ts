/** Labels and copy for the public “pay later” registration path. */

import { formatCalendarDateLong } from "@/lib/season-calendar-date";

export function formatVbsFirstDayLabel(startDate: Date): string {
  return formatCalendarDateLong(startDate, "en-US", { weekday: "long" });
}

export function buildDefaultPayLaterNotice(season: {
  name: string;
  startDate: Date;
}): string {
  const dayOne = formatVbsFirstDayLabel(season.startDate);
  return [
    "You chose to pay later. You can pay by card online anytime before VBS, or pay on site on Day 1 of VBS.",
    `On-site payment is on ${dayOne} — the first day of ${season.name} (check-in day). Acceptable methods on site are Zelle and card.`,
    "Cash and checks are not accepted on site.",
  ].join("\n\n");
}

export function resolvePayLaterNotice(
  season: { name: string; startDate: Date },
  customMessage: string | null | undefined,
): string {
  const trimmed = customMessage?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : buildDefaultPayLaterNotice(season);
}

/** Split paragraphs for UI (custom message may use blank lines). */
export function payLaterNoticeParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
