"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createVbsRegistration, type RegistrationFormState } from "./actions";

export type SeasonForForm = {
  id: string;
  name: string;
  year: number;
  classrooms: { id: string; name: string; ageMin: number; ageMax: number }[];
};

const initial: RegistrationFormState | null = null;

function hasFieldErrors(s: RegistrationFormState | null): boolean {
  return !!s?.fieldErrors && Object.keys(s.fieldErrors).length > 0;
}

const label = "block text-sm font-medium text-foreground/80";
const input =
  "mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-foreground";
const errText = "mt-1 text-sm text-red-600 dark:text-red-400";

export function RegistrationForm({ seasons }: { seasons: SeasonForForm[] }) {
  const [state, formAction, pending] = useActionState(createVbsRegistration, initial);
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");

  const classrooms = useMemo(() => {
    const s = seasons.find((x) => x.id === seasonId);
    return s?.classrooms ?? [];
  }, [seasons, seasonId]);

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      {state?.ok === true && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {state.message}{" "}
          <Link href="/registrations" className="font-medium underline">
            View registrations
          </Link>
        </div>
      )}
      {state && !state.ok && !hasFieldErrors(state) && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {state.message}
        </div>
      )}
      {state && !state.ok && hasFieldErrors(state) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          {state.message}
        </div>
      )}

      <fieldset className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground/90">
          VBS season
        </legend>
        <div>
          <label htmlFor="seasonId" className={label}>
            Season
          </label>
          <select
            id="seasonId"
            name="seasonId"
            required
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            className={input}
          >
            {seasons.length === 0 && <option value="">No seasons — add one first</option>}
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year})
              </option>
            ))}
          </select>
          {state?.fieldErrors?.seasonId && (
            <p className={errText}>{state.fieldErrors.seasonId[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="classroomId" className={label}>
            Class / crew (optional)
          </label>
          <select
            id="classroomId"
            name="classroomId"
            className={input}
            disabled={!seasonId || classrooms.length === 0}
          >
            <option value="">— Not assigned yet —</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (ages {c.ageMin}–{c.ageMax})
              </option>
            ))}
          </select>
          {state?.fieldErrors?.classroomId && (
            <p className={errText}>{state.fieldErrors.classroomId[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="status" className={label}>
            Status
          </label>
          <select id="status" name="status" className={input} defaultValue="CONFIRMED">
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="WAITLIST">Waitlist</option>
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground/90">
          Parent / guardian
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="guardianFirstName" className={label}>
              First name
            </label>
            <input
              id="guardianFirstName"
              name="guardianFirstName"
              required
              autoComplete="given-name"
              className={input}
            />
            {state?.fieldErrors?.guardianFirstName && (
              <p className={errText}>{state.fieldErrors.guardianFirstName[0]}</p>
            )}
          </div>
          <div>
            <label htmlFor="guardianLastName" className={label}>
              Last name
            </label>
            <input
              id="guardianLastName"
              name="guardianLastName"
              required
              autoComplete="family-name"
              className={input}
            />
            {state?.fieldErrors?.guardianLastName && (
              <p className={errText}>{state.fieldErrors.guardianLastName[0]}</p>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="guardianEmail" className={label}>
              Email (optional)
            </label>
            <input
              id="guardianEmail"
              name="guardianEmail"
              type="email"
              autoComplete="email"
              className={input}
            />
            {state?.fieldErrors?.guardianEmail && (
              <p className={errText}>{state.fieldErrors.guardianEmail[0]}</p>
            )}
          </div>
          <div>
            <label htmlFor="guardianPhone" className={label}>
              Phone (optional)
            </label>
            <input
              id="guardianPhone"
              name="guardianPhone"
              type="tel"
              autoComplete="tel"
              className={input}
            />
            {state?.fieldErrors?.guardianPhone && (
              <p className={errText}>{state.fieldErrors.guardianPhone[0]}</p>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground/90">
          Child
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="childFirstName" className={label}>
              First name
            </label>
            <input
              id="childFirstName"
              name="childFirstName"
              required
              autoComplete="off"
              className={input}
            />
            {state?.fieldErrors?.childFirstName && (
              <p className={errText}>{state.fieldErrors.childFirstName[0]}</p>
            )}
          </div>
          <div>
            <label htmlFor="childLastName" className={label}>
              Last name
            </label>
            <input
              id="childLastName"
              name="childLastName"
              required
              autoComplete="off"
              className={input}
            />
            {state?.fieldErrors?.childLastName && (
              <p className={errText}>{state.fieldErrors.childLastName[0]}</p>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="childDateOfBirth" className={label}>
            Date of birth
          </label>
          <input
            id="childDateOfBirth"
            name="childDateOfBirth"
            type="date"
            required
            className={input}
          />
          {state?.fieldErrors?.childDateOfBirth && (
            <p className={errText}>{state.fieldErrors.childDateOfBirth[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="allergiesNotes" className={label}>
            Allergies / medical notes (optional)
          </label>
          <textarea
            id="allergiesNotes"
            name="allergiesNotes"
            rows={3}
            className={input}
          />
          {state?.fieldErrors?.allergiesNotes && (
            <p className={errText}>{state.fieldErrors.allergiesNotes[0]}</p>
          )}
        </div>
      </fieldset>

      <div>
        <label htmlFor="notes" className={label}>
          Internal notes (optional)
        </label>
        <textarea id="notes" name="notes" rows={2} className={input} />
        {state?.fieldErrors?.notes && (
          <p className={errText}>{state.fieldErrors.notes[0]}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || seasons.length === 0}
          className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save registration"}
        </button>
        <Link
          href="/registrations"
          className="inline-flex items-center rounded-md border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/5"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
