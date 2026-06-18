"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveClassSettings, type SaveClassSettingsState } from "./actions";

type Props = {
  seasonId: string;
  seasonName: string;
  classroomsEnabled: boolean;
  classroomCount: number;
};

const initial: SaveClassSettingsState | null = null;

export function ClassSettingsForm({
  seasonId,
  seasonName,
  classroomsEnabled,
  classroomCount,
}: Props) {
  const [state, action, pending] = useActionState(saveClassSettings.bind(null, seasonId), initial);

  return (
    <form action={action} className="space-y-6">
      {state?.message ? (
        <div
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Class auto-assignment</h2>
        <p className="mt-1 text-sm text-muted">
          Control whether {seasonName} uses automatic class placement for new registrations and the
          simulate-and-approve tool.
        </p>

        <label className="mt-4 flex cursor-pointer gap-3 rounded-lg border border-foreground/10 px-3 py-3 hover:bg-foreground/[0.02]">
          <input
            type="checkbox"
            name="classroomsEnabled"
            defaultChecked={classroomsEnabled}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Enable class auto-assignment</span>
            <span className="mt-0.5 block text-xs text-muted">
              When on, new registrations can be placed into classes automatically (or via simulate
              &amp; approve). Manual assignment from the Classes page always works regardless of this
              setting.
            </span>
          </span>
        </label>

        {classroomCount === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            No classes exist for this event yet.{" "}
            <Link href={`/classes/new?season=${seasonId}`} className="font-medium underline">
              Add a class
            </Link>{" "}
            before running auto-assignment.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {classroomCount} class{classroomCount === 1 ? "" : "es"} configured.{" "}
            <Link href={`/classes?season=${seasonId}`} className="font-medium text-brand underline">
              View classes
            </Link>
            {" · "}
            <Link
              href={`/classes/auto-assign?season=${seasonId}`}
              className="font-medium text-brand underline"
            >
              Simulate auto-assign
            </Link>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
