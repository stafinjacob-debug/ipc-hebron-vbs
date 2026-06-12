"use client";

import { useActionState } from "react";
import { createProgramAction, type CreateProgramState } from "./actions";

export function CreateProgramForm({
  seasons,
}: {
  seasons: Array<{ id: string; name: string; year: number }>;
}) {
  const [state, action, pending] = useActionState<CreateProgramState | null, FormData>(
    createProgramAction,
    null,
  );
  const year = new Date().getFullYear();

  return (
    <form action={action} className="space-y-5 rounded-xl border border-foreground/10 bg-background p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium">
            Program name
          </label>
          <input
            id="name"
            name="name"
            required
            className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
            placeholder="Summer Soccer Tournament 2026"
          />
        </div>
        <div>
          <label htmlFor="year" className="block text-sm font-medium">
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            required
            defaultValue={year}
            className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="programKind" className="block text-sm font-medium">
            Template
          </label>
          <select
            id="programKind"
            name="programKind"
            className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
            defaultValue="SPORTS"
          >
            <option value="SPORTS">Sports / tournament</option>
            <option value="YOUTH">Youth event</option>
            <option value="GENERAL">General</option>
            <option value="VBS">VBS-like</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="publicRegistrationSlug" className="block text-sm font-medium">
            Public URL slug
          </label>
          <p className="mt-0.5 text-xs text-foreground/60">
            Signup link will be <span className="font-mono">/register/your-slug</span>
          </p>
          <input
            id="publicRegistrationSlug"
            name="publicRegistrationSlug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 font-mono text-sm"
            placeholder="soccer-2026"
          />
        </div>
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium">
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="theme" className="block text-sm font-medium">
            Theme (optional)
          </label>
          <input
            id="theme"
            name="theme"
            className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
          />
        </div>
        {seasons.length > 0 ? (
          <div className="sm:col-span-2">
            <label htmlFor="cloneFromSeasonId" className="block text-sm font-medium">
              Clone form from (optional)
            </label>
            <select
              id="cloneFromSeasonId"
              name="cloneFromSeasonId"
              className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Use template only</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.year})
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create program"}
      </button>
    </form>
  );
}
