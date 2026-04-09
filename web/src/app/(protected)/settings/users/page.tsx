import { auth } from "@/auth";
import type { UserRole, UserStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { fetchUsersForSettingsTable } from "@/lib/settings-users-data";
import { ASSIGNABLE_STAFF_ROLES, canManageUsers, roleLabel } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InviteUserButton } from "./invite-user-button";
import { UserStatusBadge } from "./user-status-badge";

export const metadata = {
  title: "Users & access | Settings | IPC Hebron VBS",
};

function formatScopeLabel(
  seasons: { season: { name: string; year: number } }[],
  classrooms: { classroom: { name: string } }[],
): string {
  if (seasons.length === 0 && classrooms.length === 0) return "All (default)";
  const bits: string[] = [];
  if (seasons.length) {
    bits.push(
      seasons
        .slice(0, 2)
        .map((s) => `${s.season.name} ${s.season.year}`)
        .join(", ") + (seasons.length > 2 ? ` +${seasons.length - 2}` : ""),
    );
  }
  if (classrooms.length) {
    bits.push(
      classrooms
        .slice(0, 2)
        .map((c) => c.classroom.name)
        .join(", ") + (classrooms.length > 2 ? ` +${classrooms.length - 2}` : ""),
    );
  }
  return bits.join(" · ");
}

export default async function SettingsUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role || !canManageUsers(session.user.role)) {
    redirect("/settings");
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const roleFilter = sp.role as UserRole | undefined;
  const statusFilter = sp.status as UserStatus | undefined;

  const validRole =
    roleFilter && ASSIGNABLE_STAFF_ROLES.includes(roleFilter) ? roleFilter : undefined;
  const validStatuses: UserStatus[] = [
    "INVITED",
    "PENDING_SETUP",
    "ACTIVE",
    "SUSPENDED",
    "DISABLED",
  ];
  const statusFilterLabel: Record<UserStatus, string> = {
    INVITED: "Invited",
    PENDING_SETUP: "Pending setup",
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    DISABLED: "Disabled",
  };
  const validStatus =
    statusFilter && validStatuses.includes(statusFilter) ? statusFilter : undefined;

  const { users, legacySchema } = await fetchUsersForSettingsTable({
    q,
    validRole,
    validStatus,
  });

  const [seasonsRaw, classroomsRaw] = await Promise.all([
    prisma.vbsSeason.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
      select: { id: true, name: true, year: true },
    }),
    prisma.classroom.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, season: { select: { name: true, year: true } } },
    }),
  ]);

  const seasons = seasonsRaw.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.year})`,
  }));
  const classrooms = classroomsRaw.map((c) => ({
    id: c.id,
    label: `${c.name} — ${c.season.name} ${c.season.year}`,
  }));

  const otherStaffCount = users.filter((u) => u.id !== session.user.id).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Users & access</h2>
          <p className="mt-1 max-w-xl text-sm text-foreground/70">
            Manage who can sign in and what they can access. Use simple roles—no need to configure
            individual permissions.
          </p>
        </div>
        {!legacySchema ? (
          <InviteUserButton seasons={seasons} classrooms={classrooms} actorRole={session.user.role} />
        ) : null}
      </div>

      {legacySchema ? (
        <div
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">
            Database is missing user-access columns (for example{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">status</code>).
          </p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Run{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              npx prisma migrate deploy
            </code>{" "}
            (from the <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">web</code>{" "}
            folder) so invites, statuses, and scopes work. This page is read-only until then.
          </p>
        </div>
      ) : null}

      {otherStaffCount === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/20 bg-surface-elevated/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Only you have access right now.</p>
          <p className="mt-1 text-sm text-foreground/65">
            Invite coordinators, check-in volunteers, or teachers when you&apos;re ready.
          </p>
          {!legacySchema ? (
            <div className="mt-4 flex justify-center">
              <InviteUserButton seasons={seasons} classrooms={classrooms} actorRole={session.user.role} />
            </div>
          ) : null}
        </div>
      ) : null}

      <form method="get" className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-surface-elevated p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="q" className="block text-xs font-medium text-foreground/70">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Name or email"
            defaultValue={q}
            className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-full min-w-[10rem] sm:w-44">
          <label htmlFor="role" className="block text-xs font-medium text-foreground/70">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={validRole ?? ""}
            className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            {ASSIGNABLE_STAFF_ROLES.filter(
              (r) => session.user.role === "SUPER_ADMIN" || r !== "SUPER_ADMIN",
            ).map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full min-w-[10rem] sm:w-44">
          <label htmlFor="status" className="block text-xs font-medium text-foreground/70">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={validStatus ?? ""}
            className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {validStatuses.map((s) => (
              <option key={s} value={s}>
                {statusFilterLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Apply
          </button>
          <Link
            href="/settings/users"
            className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground/80"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-foreground/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs font-semibold uppercase tracking-wide text-foreground/55">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Access scope</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3">Invited by</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {users.map((u) => (
              <tr key={u.id} className="bg-surface-elevated/30 hover:bg-surface-elevated/80">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/settings/users/${u.id}`} className="text-brand underline-offset-4 hover:underline">
                    {u.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/80">{u.email}</td>
                <td className="px-4 py-3">{roleLabel(u.role)}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-foreground/70" title={formatScopeLabel(u.seasonScopes, u.classroomScopes)}>
                  {formatScopeLabel(u.seasonScopes, u.classroomScopes)}
                </td>
                <td className="px-4 py-3">
                  <UserStatusBadge status={u.status} />
                </td>
                <td className="px-4 py-3 text-foreground/65">
                  {u.lastLoginAt
                    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(u.lastLoginAt)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-foreground/65">
                  {u.invitedBy ? u.invitedBy.name ?? u.invitedBy.email ?? "—" : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/settings/users/${u.id}`}
                    className="text-sm font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground/60">No users match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
