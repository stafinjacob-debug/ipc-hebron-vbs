"use client";

import { useActionState } from "react";
import { updateClassroomLeadersAction, type ClassActionState } from "./actions";

const initial: ClassActionState = { ok: false, message: "" };

export function ClassroomLeadersForm({
  classroomId,
  staff,
  primaryId,
  assistantIds,
}: {
  classroomId: string;
  staff: { id: string; name: string | null; email: string; role: string }[];
  primaryId: string | null;
  assistantIds: string[];
}) {
  const [state, formAction, pending] = useActionState(updateClassroomLeadersAction, initial);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-6">
      <input type="hidden" name="classroomId" value={classroomId} />
      <h2 className="text-base font-semibold text-foreground">Leaders</h2>
      <p className="text-sm text-muted">
        Primary and supporting leaders appear on class cards and rosters. Pick from active staff
        accounts.
      </p>
      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="primaryLeaderId">
          Primary leader
        </label>
        <select
          id="primaryLeaderId"
          name="primaryLeaderId"
          className="mt-1 w-full max-w-md rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          defaultValue={primaryId ?? ""}
        >
          <option value="">— None —</option>
          {staff.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name?.trim() || u.email} ({u.role})
            </option>
          ))}
        </select>
      </div>
      <div>
        <span className="block text-sm font-medium text-foreground">Supporting leaders</span>
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-foreground/10 p-3">
          {staff.map((u) => (
            <li key={u.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="assistantLeaderIds"
                value={u.id}
                defaultChecked={assistantIds.includes(u.id)}
                id={`asst-${u.id}`}
              />
              <label htmlFor={`asst-${u.id}`} className="cursor-pointer">
                {u.name?.trim() || u.email}{" "}
                <span className="text-muted">({u.role})</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save leaders"}
      </button>
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
