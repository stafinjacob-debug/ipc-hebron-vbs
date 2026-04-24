"use client";

import { useMemo, useState } from "react";
import { DEFAULT_EXPORT_FIELD_KEYS, type ExportFieldOption } from "@/lib/registration-export";

type SeasonExportConfig = {
  id: string;
  name: string;
  year: number;
  fields: ExportFieldOption[];
};

export function ExportRegistrationsModal({
  seasons,
}: {
  seasons: SeasonExportConfig[];
}) {
  const [open, setOpen] = useState(false);
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [allColumns, setAllColumns] = useState(false);

  const selected = useMemo(
    () => seasons.find((s) => s.id === seasonId) ?? seasons[0] ?? null,
    [seasonId, seasons],
  );

  if (!selected) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground/40"
      >
        Export CSV
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
      >
        Export CSV
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-foreground/15 bg-background shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Export registrations</h2>
                <p className="mt-1 text-xs text-foreground/65">
                  Select a season and columns to include. Use &quot;All columns&quot; to export everything.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground"
                aria-label="Close export dialog"
              >
                Close
              </button>
            </div>

            <form method="get" action="/registrations/export" className="space-y-4 px-5 py-4">
              <div>
                <label htmlFor="export-season" className="block text-xs font-medium text-foreground/70">
                  Season
                </label>
                <select
                  id="export-season"
                  name="season"
                  value={selected.id}
                  onChange={(e) => setSeasonId(e.target.value)}
                  className="mt-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.year})
                    </option>
                  ))}
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="all"
                  value="1"
                  checked={allColumns}
                  onChange={(e) => setAllColumns(e.target.checked)}
                  className="size-4 rounded border-foreground/30"
                />
                All columns
              </label>

              <div className="max-h-[46vh] overflow-auto rounded-lg border border-foreground/10 p-3">
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selected.fields.map((f) => (
                    <label key={f.key} className="inline-flex items-center gap-2 text-sm text-foreground/85">
                      <input
                        type="checkbox"
                        name="column"
                        value={f.key}
                        defaultChecked={DEFAULT_EXPORT_FIELD_KEYS.includes(f.key)}
                        disabled={allColumns}
                        className="size-4 rounded border-foreground/30 disabled:opacity-50"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-foreground/10 pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  Download CSV
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
