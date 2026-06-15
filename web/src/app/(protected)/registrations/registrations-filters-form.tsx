"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";

type SeasonOption = { id: string; name: string; year: number };
type ClassroomOption = { id: string; name: string };
type SelectOption = { value: string; label: string };
type DynamicFieldOption = {
  key: string;
  label: string;
  values: { value: string; label: string }[];
};

export type RegistrationsFiltersFormValues = {
  q: string;
  season: string;
  status: string;
  classroom: string;
  payment: string;
  df1k: string;
  df1v: string;
  df2k: string;
  df2v: string;
  df3k: string;
  df3v: string;
};

const FILTER_PARAM_KEYS = [
  "q",
  "season",
  "status",
  "classroom",
  "payment",
  "df1k",
  "df1v",
  "df2k",
  "df2v",
  "df3k",
  "df3v",
] as const;

export function RegistrationsFiltersForm({
  initial,
  extraColumnKeys,
  seasons,
  classrooms,
  classAssignmentStatusOptions,
  paymentStatusOptions,
  dynamicFieldOptions,
  page,
  totalPages,
  totalCount,
  filtersActive,
}: {
  initial: RegistrationsFiltersFormValues;
  extraColumnKeys: string[];
  seasons: SeasonOption[];
  classrooms: ClassroomOption[];
  classAssignmentStatusOptions: SelectOption[];
  paymentStatusOptions: SelectOption[];
  dynamicFieldOptions: DynamicFieldOption[];
  page: number;
  totalPages: number;
  totalCount: number;
  filtersActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const dynMap = new Map(dynamicFieldOptions.map((d) => [d.key, d]));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qs = new URLSearchParams();

    for (const key of FILTER_PARAM_KEYS) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) qs.set(key, v);
    }
    for (const key of extraColumnKeys) {
      qs.append("col", key);
    }
    qs.set("page", "1");

    startTransition(() => {
      const s = qs.toString();
      router.push(s ? `/registrations?${s}` : "/registrations");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {extraColumnKeys.map((key) => (
        <input key={key} type="hidden" name="col" value={key} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-foreground/70">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={initial.q}
            placeholder="Name, email, phone, registration #"
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="season" className="block text-xs font-medium text-foreground/70">
            Season
          </label>
          <select
            id="season"
            name="season"
            defaultValue={initial.season}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-foreground/70">
            Class assignment status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial.status}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            {classAssignmentStatusOptions.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="classroom" className="block text-xs font-medium text-foreground/70">
            Classroom
          </label>
          <select
            id="classroom"
            name="classroom"
            defaultValue={initial.classroom}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="__unassigned">Unassigned</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment" className="block text-xs font-medium text-foreground/70">
            Payment status
          </label>
          <select
            id="payment"
            name="payment"
            defaultValue={initial.payment}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            {paymentStatusOptions.map((o) => (
              <option key={o.value || "any-pay"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <details className="rounded-lg border border-foreground/10 bg-background/40 p-3">
        <summary className="cursor-pointer text-xs font-medium text-foreground/80">
          Form field filters (predefined options)
        </summary>
        <div className="mt-3 space-y-2">
          {dynamicFieldOptions.length === 0 ? (
            <p className="text-xs text-foreground/55">
              Select a season with a configured form field options list (select/radio/boolean) to use
              dynamic filters.
            </p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-3">
              {(
                [
                  { keyName: "df1k", valName: "df1v" },
                  { keyName: "df2k", valName: "df2v" },
                  { keyName: "df3k", valName: "df3v" },
                ] as const
              ).map((slot, idx) => {
                const { keyName, valName } = slot;
                const selectedKey = initial[keyName];
                const values = dynMap.get(selectedKey)?.values ?? [];
                return (
                  <div key={keyName} className="rounded-md border border-foreground/10 p-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">
                      Dynamic filter {idx + 1}
                    </p>
                    <select
                      name={keyName}
                      defaultValue={selectedKey}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="">None</option>
                      {dynamicFieldOptions.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      name={valName}
                      defaultValue={initial[valName]}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="">Any value</option>
                      {values.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Applying…" : "Apply filters"}
        </button>
        <span className="text-xs text-foreground/60">
          {filtersActive ? (
            <>
              Showing <strong className="font-semibold tabular-nums">{totalCount}</strong> matching
              registration{totalCount === 1 ? "" : "s"} · Page {page} of {totalPages}
            </>
          ) : (
            <>
              Page {page} of {totalPages}
            </>
          )}
        </span>
      </div>
    </form>
  );
}
