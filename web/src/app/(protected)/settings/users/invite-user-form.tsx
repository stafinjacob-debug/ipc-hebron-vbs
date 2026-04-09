"use client";

import { useActionState, useEffect, useState } from "react";
import type { UserRole } from "@/generated/prisma";
import { ASSIGNABLE_STAFF_ROLES, canAssignRole, roleLabel } from "@/lib/roles";
import { inviteStaffUser, type UserMgmtState } from "./actions";

const initial: UserMgmtState | null = null;

type SeasonOpt = { id: string; label: string };
type ClassOpt = { id: string; label: string };

export function InviteUserForm({
  seasons,
  classrooms,
  actorRole,
  onClose,
}: {
  seasons: SeasonOpt[];
  classrooms: ClassOpt[];
  actorRole: UserRole;
  onClose: () => void;
}) {
  const assignable = ASSIGNABLE_STAFF_ROLES.filter((r) => canAssignRole(actorRole, r));

  const [state, action, pending] = useActionState(inviteStaffUser, initial);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state?.inviteLink) setCopied(false);
  }, [state?.inviteLink]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-foreground/10 bg-surface-elevated p-6 shadow-xl"
        role="dialog"
        aria-labelledby="invite-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="invite-title" className="text-lg font-semibold text-foreground">
              Invite user
            </h2>
            <p className="mt-1 text-sm text-foreground/65">
              If Microsoft Graph is configured in the server environment, we email this link automatically.
              You can always copy it below to send manually.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-foreground/60 hover:bg-foreground/10"
          >
            Close
          </button>
        </div>

        <form action={action} className="mt-6 space-y-4">
          {state && !state.ok ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
              {state.message}
            </p>
          ) : null}
          {state?.ok && state.inviteLink ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-950 dark:text-emerald-100">
              <p className="font-medium">{state.message}</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="block max-w-full truncate rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                  {state.inviteLink}
                </code>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                  onClick={async () => {
                    await navigator.clipboard.writeText(state.inviteLink!);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="invite-name" className="block text-sm font-medium text-foreground">
              Full name
            </label>
            <input
              id="invite-name"
              name="name"
              required
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-foreground">
              Role
            </label>
            <select
              id="invite-role"
              name="role"
              required
              className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
            >
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="rounded-lg border border-foreground/10 p-3">
            <legend className="px-1 text-xs font-medium text-foreground/70">Access scope (optional)</legend>
            <p className="mb-2 text-xs text-foreground/55">
              Leave empty for full access within their role. Limit seasons or classes when needed.
            </p>
            {seasons.length > 0 ? (
              <div className="mb-3">
                <span className="text-xs font-medium text-foreground/80">Seasons</span>
                <div className="mt-1 max-h-28 space-y-1 overflow-y-auto text-sm">
                  {seasons.map((s) => (
                    <label key={s.id} className="flex items-center gap-2">
                      <input type="checkbox" name="seasonScope" value={s.id} className="rounded border-foreground/20" />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {classrooms.length > 0 ? (
              <div>
                <span className="text-xs font-medium text-foreground/80">Classes</span>
                <div className="mt-1 max-h-28 space-y-1 overflow-y-auto text-sm">
                  {classrooms.map((c) => (
                    <label key={c.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="classroomScope"
                        value={c.id}
                        className="rounded border-foreground/20"
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
