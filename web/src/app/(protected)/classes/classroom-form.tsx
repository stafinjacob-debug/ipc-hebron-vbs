"use client";

import type { Classroom } from "@/generated/prisma";
import { jsonToStringArray } from "@/lib/class-form-field-match";
import Link from "next/link";
import { useActionState } from "react";
import {
  createClassroomAction,
  updateClassroomAction,
  type ClassActionState,
} from "./actions";

const initial: ClassActionState = { ok: false, message: "" };

const label = "block text-sm font-medium text-foreground";
const input =
  "mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand";
const sectionTitle = "text-base font-semibold text-foreground";

export function ClassroomForm({
  mode,
  classroom,
  seasonId,
  seasons,
  assignableChildFields = [],
}: {
  mode: "create" | "edit";
  classroom?: Classroom;
  seasonId: string;
  seasons: { id: string; name: string; year: number }[];
  /** From the season’s published registration form (per-child fields). */
  assignableChildFields?: { key: string; label: string }[];
}) {
  const action = mode === "create" ? createClassroomAction : updateClassroomAction;
  const [state, formAction, pending] = useActionState(action, initial);

  const c = classroom;

  return (
    <form action={formAction} className="mx-auto max-w-3xl space-y-8">
      {mode === "edit" && c ? (
        <input type="hidden" name="classroomId" value={c.id} />
      ) : null}

      <section className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-6">
        <h2 className={sectionTitle}>Basic info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="seasonId">
              Season
            </label>
            <select
              id="seasonId"
              name="seasonId"
              className={input}
              required
              defaultValue={c?.seasonId ?? seasonId}
              disabled={mode === "edit"}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.year})
                </option>
              ))}
            </select>
            {mode === "edit" ? (
              <p className="mt-1 text-xs text-muted">Season cannot be changed after creation.</p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="name">
              Class name
            </label>
            <input
              id="name"
              name="name"
              className={input}
              required
              defaultValue={c?.name ?? ""}
              placeholder="e.g. Elementary Crew"
            />
          </div>
          <div>
            <label className={label} htmlFor="internalCode">
              Internal code (optional)
            </label>
            <input
              id="internalCode"
              name="internalCode"
              className={input}
              defaultValue={c?.internalCode ?? ""}
            />
          </div>
          <div>
            <label className={label} htmlFor="sortOrder">
              Match priority (lower = first)
            </label>
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              className={input}
              defaultValue={c?.sortOrder ?? 0}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="description">
              Description (optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className={input}
              defaultValue={c?.description ?? ""}
            />
          </div>
          <div>
            <label className={label} htmlFor="isActive">
              Listing status
            </label>
            <select
              id="isActive"
              name="isActive"
              className={input}
              defaultValue={c?.isActive !== false ? "true" : "false"}
            >
              <option value="true">Active</option>
              <option value="false">Inactive / hidden</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="intakeStatus">
              New enrollments (auto-placement)
            </label>
            <select
              id="intakeStatus"
              name="intakeStatus"
              className={input}
              defaultValue={c?.intakeStatus ?? "OPEN"}
            >
              <option value="OPEN">Open — auto-assign eligible students</option>
              <option value="CLOSED">Closed — no new auto-placement</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-6">
        <h2 className={sectionTitle}>Eligibility (age rules)</h2>
        <p className="text-sm text-muted">
          Students are matched by whole-year age. Overlapping bands across classes are allowed but
          will show a warning — use priority order to break ties.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label} htmlFor="ageMin">
              Minimum age
            </label>
            <input
              id="ageMin"
              name="ageMin"
              type="number"
              min={0}
              max={99}
              className={input}
              required
              defaultValue={c?.ageMin ?? 5}
            />
          </div>
          <div>
            <label className={label} htmlFor="ageMax">
              Maximum age
            </label>
            <input
              id="ageMax"
              name="ageMax"
              type="number"
              min={0}
              max={99}
              className={input}
              required
              defaultValue={c?.ageMax ?? 10}
            />
          </div>
          <div>
            <label className={label} htmlFor="ageRule">
              Age as of
            </label>
            <select
              id="ageRule"
              name="ageRule"
              className={input}
              defaultValue={c?.ageRule ?? "EVENT_START_DATE"}
            >
              <option value="EVENT_START_DATE">Event / VBS start date (recommended)</option>
              <option value="REGISTRATION_DATE">Registration date</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="gradeLabel">
              Grade label (display only)
            </label>
            <input
              id="gradeLabel"
              name="gradeLabel"
              className={input}
              defaultValue={c?.gradeLabel ?? ""}
              placeholder="e.g. Grades 1–3"
            />
          </div>
          <div className="sm:col-span-3">
            <label className={label} htmlFor="eligibilityNotes">
              Eligibility notes / exceptions (optional)
            </label>
            <textarea
              id="eligibilityNotes"
              name="eligibilityNotes"
              rows={2}
              className={input}
              defaultValue={c?.eligibilityNotes ?? ""}
            />
          </div>
        </div>
        <div className="mt-6 border-t border-foreground/10 pt-6">
          <h3 className="text-sm font-semibold text-foreground">Form field match (optional)</h3>
          <p className="mt-1 text-sm text-muted">
            After the age band matches, auto-assignment can require a per-child registration answer
            (e.g. grade or track) to equal one of the values below. Comparison is case-insensitive.
            Leave blank to use age only.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="matchFormFieldKey">
                Registration field key
              </label>
              <input
                id="matchFormFieldKey"
                name="matchFormFieldKey"
                className={input}
                list={
                  assignableChildFields.length > 0 ? "assignable-child-field-keys" : undefined
                }
                defaultValue={c?.matchFormFieldKey ?? ""}
                placeholder="e.g. gradeLevel (must match your form builder key)"
                autoComplete="off"
              />
              {assignableChildFields.length > 0 ? (
                <datalist id="assignable-child-field-keys">
                  {assignableChildFields.map((f) => (
                    <option key={f.key} value={f.key} label={f.label} />
                  ))}
                </datalist>
              ) : null}
              {assignableChildFields.length > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  Suggestions from the published form for this season. You can type any child-scoped
                  field key.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  No published registration form found for this season — enter the exact field key from
                  your form definition.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="matchFormFieldValues">
                Allowed values (one per line or comma-separated)
              </label>
              <textarea
                id="matchFormFieldValues"
                name="matchFormFieldValues"
                rows={3}
                className={input}
                defaultValue={
                  c?.matchFormFieldValues != null
                    ? jsonToStringArray(c.matchFormFieldValues).join("\n")
                    : ""
                }
                placeholder={"K\n1\n2"}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-6">
        <h2 className={sectionTitle}>Capacity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="capacity">
              Maximum seats
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={0}
              className={input}
              required
              defaultValue={c?.capacity ?? 24}
            />
          </div>
          <div>
            <label className={label} htmlFor="waitlistEnabled">
              Class waitlist
            </label>
            <select
              id="waitlistEnabled"
              name="waitlistEnabled"
              className={input}
              defaultValue={c?.waitlistEnabled !== false ? "true" : "false"}
            >
              <option value="true">Enabled — full classes accept waitlist</option>
              <option value="false">Disabled — overflow to next matching class</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-6">
        <h2 className={sectionTitle}>Logistics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="room">
              Room / location
            </label>
            <input id="room" name="room" className={input} defaultValue={c?.room ?? ""} />
          </div>
          <div>
            <label className={label} htmlFor="checkInLabel">
              Check-in label
            </label>
            <input
              id="checkInLabel"
              name="checkInLabel"
              className={input}
              defaultValue={c?.checkInLabel ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="badgeDisplayName">
              Badge display name
            </label>
            <input
              id="badgeDisplayName"
              name="badgeDisplayName"
              className={input}
              defaultValue={c?.badgeDisplayName ?? ""}
              placeholder="Short name for badges"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="adminNotes">
              Staff notes (internal)
            </label>
            <textarea
              id="adminNotes"
              name="adminNotes"
              rows={2}
              className={input}
              defaultValue={c?.adminNotes ?? ""}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "create" ? "Create class" : "Save changes"}
        </button>
      </div>

      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
        >
          {state.message}
        </p>
      ) : null}
      {state.ok && state.classroomId && mode === "create" ? (
        <p className="text-sm">
          <Link
            href={`/classes/${state.classroomId}/edit`}
            className="font-semibold text-brand underline"
          >
            Open class setup (leaders & logistics) →
          </Link>
        </p>
      ) : null}
      {state.warnings?.length ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-medium">Warnings</p>
          <ul className="mt-2 list-disc pl-5">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
