"use client";

import { useMemo, useState } from "react";
import type { CampDateOption } from "@/lib/camp-date";

type SeasonOption = {
  id: string;
  name: string;
  year: number;
  multiDayCheckInEnabled: boolean;
  campDates: CampDateOption[];
  defaultCampDate: string;
};

type Props = {
  seasons: SeasonOption[];
};

export function AttendanceExportPanel({ seasons }: Props) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === seasonId) ?? seasons[0] ?? null,
    [seasonId, seasons],
  );
  const [campDate, setCampDate] = useState(selectedSeason?.defaultCampDate ?? "");

  const campDates = selectedSeason?.campDates ?? [];

  function onSeasonChange(nextSeasonId: string) {
    setSeasonId(nextSeasonId);
    const next = seasons.find((s) => s.id === nextSeasonId);
    setCampDate(next?.defaultCampDate ?? "");
  }

  const exportHref =
    seasonId && campDate
      ? `/reports/attendance-export?season=${encodeURIComponent(seasonId)}&date=${encodeURIComponent(campDate)}`
      : null;

  if (seasons.length === 0) {
    return <p className="text-sm text-muted">Add a season to export attendance.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-foreground">Season</span>
          <select
            value={seasonId}
            onChange={(e) => onSeasonChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-foreground">Camp day</span>
          <select
            value={campDate}
            onChange={(e) => setCampDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
          >
            {campDates.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
                {d.isToday ? " (today)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSeason?.multiDayCheckInEnabled ? (
        <p className="text-sm text-muted">
          Multi-day check-in is enabled for this season. Export includes per-day arrival and dismissal times.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Single-day mode: export reflects check-ins recorded for the selected date.
        </p>
      )}

      {exportHref ? (
        <a
          href={exportHref}
          className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          Download attendance CSV
        </a>
      ) : null}
    </div>
  );
}
