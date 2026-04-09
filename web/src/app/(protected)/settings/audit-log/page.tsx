import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Audit log | Settings | IPC Hebron VBS",
};

const ACTION_LABELS: Record<string, string> = {
  USER_INVITED: "User invited",
  INVITE_RESENT: "Invite resent",
  INVITE_ACCEPTED: "Invite accepted",
  USER_ROLE_CHANGED: "Role changed",
  USER_STATUS_CHANGED: "Status changed",
  USER_SCOPES_UPDATED: "Access scope updated",
  USER_PASSWORD_SET_BY_ADMIN: "Password set by admin",
  USER_ACCESS_REMOVED: "Access removed",
  LOGIN_FAILED: "Failed sign-in",
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

export default async function SettingsAuditLogPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role || !canManageUsers(session.user.role)) {
    redirect("/settings");
  }

  const rows = await prisma.staffAccessAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { name: true, email: true } },
      targetUser: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Audit log</h2>
        <p className="mt-1 max-w-2xl text-sm text-foreground/70">
          Sign-ins, invitations, and access changes for child and medical data accountability. Showing the
          200 most recent events.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-foreground/15 px-6 py-10 text-center text-sm text-foreground/60">
          No events recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs font-semibold uppercase tracking-wide text-foreground/55">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target user</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {rows.map((r) => (
                <tr key={r.id} className="bg-surface-elevated/30">
                  <td className="whitespace-nowrap px-4 py-3 text-foreground/70">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{formatAction(r.action)}</td>
                  <td className="px-4 py-3 text-foreground/75">
                    {r.actor ? (
                      <>
                        {r.actor.name ?? r.actor.email}
                        {r.actorUserId === session.user.id ? (
                          <span className="ml-1 text-xs text-foreground/45">(you)</span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/75">
                    {r.targetUserId ? (
                      <Link
                        href={`/settings/users/${r.targetUserId}`}
                        className="text-brand underline-offset-4 hover:underline"
                      >
                        {r.targetUser?.name ?? r.targetUser?.email ?? "User record"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-foreground/55">
                    {r.metadata ? JSON.stringify(r.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
