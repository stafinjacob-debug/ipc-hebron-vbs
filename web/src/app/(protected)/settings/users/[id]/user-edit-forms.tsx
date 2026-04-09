"use client";

import { useActionState, useState } from "react";
import type { UserRole, UserStatus } from "@/generated/prisma";
import { ASSIGNABLE_STAFF_ROLES, canAssignRole, roleLabel } from "@/lib/roles";
import Link from "next/link";
import {
  removeUserAccess,
  submitAdminPasswordForm,
  submitResendInviteForm,
  submitUserRoleForm,
  submitUserScopesForm,
  submitUserStatusForm,
  type UserMgmtState,
} from "../actions";
import { UserStatusBadge } from "../user-status-badge";

const initial: UserMgmtState | null = null;

const STATUS_OPTIONS: UserStatus[] = [
  "INVITED",
  "PENDING_SETUP",
  "ACTIVE",
  "SUSPENDED",
  "DISABLED",
];

function statusLabel(s: UserStatus): string {
  switch (s) {
    case "PENDING_SETUP":
      return "Pending setup";
    default:
      return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
  }
}

export function UserEditForms(props: {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    status: UserStatus;
    lastLoginAt: string | null;
    invitedAt: string | null;
    invitedBy: { name: string | null; email: string | null } | null;
    seasonScopes: { seasonId: string }[];
    classroomScopes: { classroomId: string }[];
  };
  actorUserId: string;
  actorRole: UserRole;
  seasons: { id: string; label: string }[];
  classrooms: { id: string; label: string }[];
  /** DB missing `User.status` / invite columns — forms would error until migrations run. */
  legacySchema?: boolean;
}) {
  const { user, actorUserId, actorRole, seasons, classrooms, legacySchema = false } = props;
  const isSelf = user.id === actorUserId;

  const assignableRoles = ASSIGNABLE_STAFF_ROLES.filter((r) => canAssignRole(actorRole, r));

  const actorCanManageTarget = user.role !== "PARENT" && canAssignRole(actorRole, user.role);

  const [roleState, roleAction, rolePending] = useActionState(submitUserRoleForm, initial);
  const [statusState, statusAction, statusPending] = useActionState(submitUserStatusForm, initial);
  const [scopeState, scopeAction, scopePending] = useActionState(submitUserScopesForm, initial);
  const [pwdState, pwdAction, pwdPending] = useActionState(submitAdminPasswordForm, initial);
  const [resendState, resendAction, resendPending] = useActionState(submitResendInviteForm, initial);

  const [removeMsg, setRemoveMsg] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [resendCopied, setResendCopied] = useState(false);

  const canResendInvite =
    !isSelf &&
    actorCanManageTarget &&
    (user.status === "INVITED" || user.status === "PENDING_SETUP");

  return (
    <div className="space-y-8">
      {!legacySchema ? (
        <>
          {(roleState && !roleState.ok) || (statusState && !statusState.ok) || (scopeState && !scopeState.ok) ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
              {roleState && !roleState.ok
                ? roleState.message
                : statusState && !statusState.ok
                  ? statusState.message
                  : scopeState!.message}
            </p>
          ) : null}
          {roleState?.ok ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
              {roleState.message}
            </p>
          ) : null}
          {statusState?.ok ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
              {statusState.message}
            </p>
          ) : null}
          {scopeState?.ok ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
              {scopeState.message}
            </p>
          ) : null}
        </>
      ) : null}

      <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Account</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-foreground/55">Email</dt>
            <dd className="font-medium text-foreground">{user.email}</dd>
          </div>
          <div>
            <dt className="text-foreground/55">Status</dt>
            <dd className="mt-0.5">
              <UserStatusBadge status={user.status} />
            </dd>
          </div>
          <div>
            <dt className="text-foreground/55">Last active</dt>
            <dd className="text-foreground/80">
              {user.lastLoginAt
                ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(user.lastLoginAt),
                  )
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-foreground/55">Invited</dt>
            <dd className="text-foreground/80">
              {user.invitedAt
                ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(user.invitedAt))
                : "—"}
              {user.invitedBy ? (
                <span className="block text-xs text-foreground/55">
                  by {user.invitedBy.name ?? user.invitedBy.email ?? "—"}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      {legacySchema ? (
        <div
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">User management actions are turned off.</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Your database has not applied the user-access migration yet (missing columns such as{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">status</code>). Run{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              npx prisma migrate deploy
            </code>{" "}
            from the <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">web</code> folder,
            then reload this page.
          </p>
        </div>
      ) : null}

      {!legacySchema && !isSelf && actorCanManageTarget ? (
        <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Role</h3>
          <p className="mt-1 text-xs text-foreground/55">
            Changing role changes what they see in the sidebar and what actions they can take.
          </p>
          <form action={roleAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="userId" value={user.id} />
            <div className="flex-1">
              <label htmlFor="role" className="block text-xs font-medium text-foreground/70">
                Assigned role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={user.role}
                className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={rolePending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              {rolePending ? "Saving…" : "Save role"}
            </button>
          </form>
        </section>
      ) : null}

      {!legacySchema && isSelf ? (
        <p className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground/70">
          You can&apos;t change your own role or access status from this screen.
        </p>
      ) : null}

      {!legacySchema && !isSelf && actorCanManageTarget ? (
        <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Status</h3>
          <p className="mt-1 text-xs text-foreground/55">
            Suspend temporarily or disable to remove sign-in. Invited users are waiting to finish setup.
          </p>
          <form action={statusAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="userId" value={user.id} />
            <div className="flex-1">
              <label htmlFor="status" className="block text-xs font-medium text-foreground/70">
                Account status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={user.status}
                className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={statusPending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              {statusPending ? "Saving…" : "Save status"}
            </button>
          </form>
        </section>
      ) : null}

      {!legacySchema && !isSelf && actorCanManageTarget ? (
        <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Access scope</h3>
          <p className="mt-1 text-xs text-foreground/55">
            Optional limits by season or class. Leave unchecked for full access within their role.
          </p>
          <form action={scopeAction} className="mt-4 space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            {seasons.length > 0 ? (
              <div>
                <span className="text-xs font-medium text-foreground/80">Seasons</span>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto text-sm">
                  {seasons.map((s) => (
                    <label key={s.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="seasonScope"
                        value={s.id}
                        defaultChecked={user.seasonScopes.some((x) => x.seasonId === s.id)}
                        className="rounded border-foreground/20"
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {classrooms.length > 0 ? (
              <div>
                <span className="text-xs font-medium text-foreground/80">Classes</span>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto text-sm">
                  {classrooms.map((c) => (
                    <label key={c.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="classroomScope"
                        value={c.id}
                        defaultChecked={user.classroomScopes.some((x) => x.classroomId === c.id)}
                        className="rounded border-foreground/20"
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={scopePending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              {scopePending ? "Saving…" : "Save scope"}
            </button>
          </form>
        </section>
      ) : null}

      {!legacySchema && !isSelf && actorCanManageTarget ? (
        <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Invitation</h3>
          {canResendInvite ? (
            <form action={resendAction} className="mt-3 space-y-3">
              <input type="hidden" name="userId" value={user.id} />
              <p className="text-xs text-foreground/55">
                Generate a fresh link if the first one expired or was lost.
              </p>
              <button
                type="submit"
                disabled={resendPending}
                className="rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {resendPending ? "Working…" : "Resend invite / new link"}
              </button>
              {resendState && !resendState.ok ? (
                <p className="text-sm text-red-700 dark:text-red-200">{resendState.message}</p>
              ) : null}
              {resendState?.ok && resendState.inviteLink ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">{resendState.message}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="block max-w-full truncate rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                      {resendState.inviteLink}
                    </code>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                      onClick={async () => {
                        await navigator.clipboard.writeText(resendState.inviteLink!);
                        setResendCopied(true);
                      }}
                    >
                      {resendCopied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </div>
              ) : null}
            </form>
          ) : (
            <p className="mt-2 text-sm text-foreground/60">
              This user has already finished setup, or their account isn&apos;t in an invite state.
            </p>
          )}
        </section>
      ) : null}

      {!legacySchema && actorRole === "SUPER_ADMIN" && !isSelf && actorCanManageTarget ? (
        <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Set password (emergency)</h3>
          <p className="mt-1 text-xs text-foreground/55">
            Prefer invites. Use only when someone is locked out and you&apos;ve verified their identity.
          </p>
          {pwdState && !pwdState.ok ? (
            <p className="mt-3 text-sm text-red-700 dark:text-red-200">{pwdState.message}</p>
          ) : null}
          {pwdState?.ok ? (
            <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-100">{pwdState.message}</p>
          ) : null}
          <form action={pwdAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="userId" value={user.id} />
            <div className="flex-1">
              <label htmlFor="password" className="block text-xs font-medium text-foreground/70">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={pwdPending}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pwdPending ? "Saving…" : "Set password"}
            </button>
          </form>
        </section>
      ) : null}

      {!legacySchema && !isSelf && actorCanManageTarget ? (
        <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">Remove access</h3>
          <p className="mt-1 text-xs text-foreground/65">
            They will be signed out on next request and cannot sign in until an admin re-enables them.
          </p>
          <button
            type="button"
            disabled={removeBusy}
            className="mt-4 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-900 disabled:opacity-50 dark:text-red-100"
            onClick={async () => {
              if (
                !window.confirm(
                  "Remove access for this user? They will no longer be able to sign in to the admin portal.",
                )
              ) {
                return;
              }
              setRemoveBusy(true);
              setRemoveMsg(null);
              const r = await removeUserAccess(user.id);
              setRemoveMsg(r.message);
              setRemoveBusy(false);
            }}
          >
            {removeBusy ? "Working…" : "Remove access"}
          </button>
          {removeMsg ? <p className="mt-2 text-sm text-foreground/80">{removeMsg}</p> : null}
        </section>
      ) : null}

      <p className="text-center text-sm">
        <Link href="/settings/users" className="font-medium text-brand underline-offset-4 hover:underline">
          ← Back to users
        </Link>
      </p>
    </div>
  );
}
