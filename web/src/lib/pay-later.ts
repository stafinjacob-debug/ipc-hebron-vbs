/** Labels and copy for the public “pay later” registration path. */

import { formatCalendarDateLong } from "@/lib/season-calendar-date";

/** Shown when payment is still due (emails and pay-later notices). */
export const VBS_PAYMENT_DEADLINE_NOTICE =
  "To finalize your child's VBS registration, payment must be received by the first day of VBS. Unfortunately unpaid registrations will not be eligible to attend VBS or receive a VBS t-shirt.";

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

export type PaymentDeadlineNoticeContext = {
  eventName: string;
  participantSingularLabel: string;
  isLegacyVbs: boolean;
};

export function buildDefaultPaymentDeadlineNotice(ctx: PaymentDeadlineNoticeContext): string {
  if (ctx.isLegacyVbs) {
    return VBS_PAYMENT_DEADLINE_NOTICE;
  }
  const who = ctx.participantSingularLabel.trim().toLowerCase() || "participant";
  const eventName = ctx.eventName.trim() || "this event";
  return `To finalize your registration for ${eventName}, payment must be received by the first day of the event. Unpaid registrations may not be eligible to attend or participate as a registered ${who}.`;
}

export function resolvePaymentDeadlineNotice(
  ctx: PaymentDeadlineNoticeContext,
  customMessage: string | null | undefined,
): string {
  const trimmed = customMessage?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : buildDefaultPaymentDeadlineNotice(ctx);
}

/** Split paragraphs for UI (custom message may use blank lines). */
export function payLaterNoticeParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
