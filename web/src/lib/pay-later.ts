/** Labels and copy for the public “pay later” registration path. */

export function formatVbsFirstDayLabel(startDate: Date): string {
  return startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function buildDefaultPayLaterNotice(season: {
  name: string;
  startDate: Date;
}): string {
  const dayOne = formatVbsFirstDayLabel(season.startDate);
  return [
    "You chose to pay later. Acceptable payment methods are card (online before VBS) or digital payment on site.",
    `The last day to complete payment is ${dayOne} — the first day of ${season.name} (on-site check-in).`,
    "For on-site payment: cash and checks are not accepted. Digital options available on site are Zelle and card.",
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
