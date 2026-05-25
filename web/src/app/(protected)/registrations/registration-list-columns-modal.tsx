"use client";

import { useMemo, useState } from "react";
import type { ExportFieldOption } from "@/lib/registration-export";

type SeasonColumnConfig = {
  id: string;
  name: string;
  year: number;
  fields: ExportFieldOption[];
};

export function RegistrationListColumnsModal({
  seasons,
  selectedSeasonId,
  activeColumnKeys,
}: {
  seasons: SeasonColumnConfig[];
  selectedSeasonId: string;
  activeColumnKeys: string[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(activeColumnKeys));

  const season =
    seasons.find((s) => s.id === selectedSeasonId) ?? seasons[0] ?? null;

  const selectable = useMemo(
    () => (season?.fields ?? []).filter((f) => f.group === "guardian" || f.group === "child"),
    [season],
  );

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyColumns() {
    const url = new URL(window.location.href);
    url.searchParams.delete("col");
    for (const key of picked) url.searchParams.append("col", key);
    url.searchParams.set("page", "1");
    window.location.href = url.toString();
  }

  function clearColumns() {
    const url = new URL(window.location.href);
    url.searchParams.delete("col");
    url.searchParams.set("page", "1");
    window.location.href = url.toString();
  }

  if (!season) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPicked(new Set(activeColumnKeys));
          setOpen(true);
        }}
        className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
      >
        Columns{activeColumnKeys.length > 0 ? ` (${activeColumnKeys.length})` : ""}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-foreground/15 bg-background shadow-xl">
            <div className="border-b border-foreground/10 px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">Table columns</h2>
              <p className="mt-1 text-xs text-foreground/65">
                Add registration form fields as extra columns for{" "}
                <strong>{season.name}</strong>. Standard columns stay fixed.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selectable.length === 0 ? (
                <p className="text-sm text-muted">
                  No extra form fields available. Publish a registration form for this season first.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {selectable.map((f) => (
                    <li key={f.key}>
                      <label className="flex cursor-pointer gap-2 rounded-lg border border-foreground/10 px-3 py-2 text-sm hover:bg-foreground/[0.03]">
                        <input
                          type="checkbox"
                          checked={picked.has(f.key)}
                          onChange={() => toggle(f.key)}
                          className="mt-0.5"
                        />
                        <span>{f.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-foreground/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearColumns}
                className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
              >
                Clear extra columns
              </button>
              <button
                type="button"
                onClick={applyColumns}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
              >
                Apply columns
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
