import { appTodayDateKey } from "@/lib/app-timezone";
import { normalizeCalendarDateInput } from "@/lib/season-calendar-date";

export type EventPhase = "none" | "setup" | "live" | "wrapup";

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86400000);
}

export function getEventContext(
  now: Date,
  seasonStart: Date | null,
  seasonEnd: Date | null,
): {
  phase: EventPhase;
  daysUntilStart: number | null;
  eventDayLabel: string | null;
} {
  if (!seasonStart || !seasonEnd) {
    return { phase: "none", daysUntilStart: null, eventDayLabel: null };
  }

  const today = appTodayDateKey(now);
  const startKey = normalizeCalendarDateInput(seasonStart);
  const endKey = normalizeCalendarDateInput(seasonEnd);

  if (today < startKey) {
    return {
      phase: "setup",
      daysUntilStart: daysBetween(today, startKey),
      eventDayLabel: null,
    };
  }
  if (today > endKey) {
    return { phase: "wrapup", daysUntilStart: null, eventDayLabel: null };
  }

  const dayNum = daysBetween(startKey, today) + 1;
  const totalDays = daysBetween(startKey, endKey) + 1;
  return { phase: "live", daysUntilStart: null, eventDayLabel: `Day ${dayNum} of ${totalDays}` };
}
