"use client";

import type { CampDateOption } from "@/lib/camp-date";
import { useRouter } from "next/navigation";

export function DashboardCampDatePicker({
  campDates,
  selectedCampDate,
}: {
  campDates: CampDateOption[];
  selectedCampDate: string;
}) {
  const router = useRouter();

  if (campDates.length === 0) return null;

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface-elevated px-4 py-3 shadow-sm">
      <label className="block text-sm">
        <span className="font-semibold text-foreground">Check-in date</span>
        <span className="mt-0.5 block text-xs font-normal text-muted">
          Super admins can review attendance totals from earlier camp days.
        </span>
        <select
          value={selectedCampDate}
          onChange={(e) => {
            const next = e.target.value;
            router.push(
              next
                ? `/dashboard?campDate=${encodeURIComponent(next)}`
                : "/dashboard",
            );
          }}
          className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm sm:max-w-xs"
        >
          {campDates.map((day) => (
            <option key={day.key} value={day.key}>
              {day.label}
              {day.isToday ? " (today)" : day.isPast ? " (past)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
