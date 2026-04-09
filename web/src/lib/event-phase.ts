export type EventPhase = "none" | "setup" | "live" | "wrapup";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
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
  const t = startOfDay(now);
  const s = startOfDay(seasonStart);
  const e = startOfDay(seasonEnd);
  if (t < s) {
    const daysUntilStart = Math.ceil((s.getTime() - t.getTime()) / 86400000);
    return { phase: "setup", daysUntilStart, eventDayLabel: null };
  }
  if (t > e) {
    return { phase: "wrapup", daysUntilStart: null, eventDayLabel: null };
  }
  const dayNum = Math.floor((t.getTime() - s.getTime()) / 86400000) + 1;
  const totalDays = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
  return { phase: "live", daysUntilStart: null, eventDayLabel: `Day ${dayNum} of ${totalDays}` };
}
