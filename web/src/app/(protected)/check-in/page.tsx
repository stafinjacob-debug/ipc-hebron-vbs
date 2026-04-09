import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canUseCheckInActions } from "@/lib/permissions";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { toggleCheckInForm } from "./actions";

export default async function CheckInPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canUseCheckInActions(session.user.role)) redirect("/dashboard");

  const activeSeason = await prisma.vbsSeason.findFirst({
    where: { isActive: true },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
  });

  const rows = activeSeason
    ? await prisma.registration.findMany({
        where: { seasonId: activeSeason.id, status: { not: "CANCELLED" } },
        orderBy: [{ checkedInAt: "asc" }, { child: { lastName: "asc" } }],
        include: { child: true, classroom: true },
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardCheck className="size-7 text-brand" aria-hidden />
            Check-in desk
          </h1>
          <p className="mt-1 text-muted">
            Mark arrivals for your active VBS season. Families can be searched by name in this list.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>

      {!activeSeason && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-foreground">
          <p className="font-medium text-amber-900 dark:text-amber-100">No active season</p>
          <p className="mt-1 text-foreground/80">
            Set a season as active under{" "}
            <Link href="/seasons" className="font-medium text-brand underline">
              VBS seasons
            </Link>{" "}
            to use check-in.
          </p>
        </div>
      )}

      {activeSeason && (
        <p className="text-sm text-muted">
          Checking in: <span className="font-medium text-foreground">{activeSeason.name}</span>
        </p>
      )}

      {activeSeason && rows.length === 0 && (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated px-6 py-10 text-center">
          <p className="font-medium text-foreground">No registrations for this season yet</p>
          <p className="mt-2 text-sm text-muted">When families register, they will appear here for check-in.</p>
          <Link
            href="/registrations/new"
            className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            Add registration
          </Link>
        </div>
      )}

      {activeSeason && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Check-in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isIn = !!r.checkedInAt;
                return (
                  <tr key={r.id} className="border-t border-foreground/10">
                    <td className="px-4 py-3 font-medium">
                      {r.child.firstName} {r.child.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.classroom?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {isIn ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          Checked in
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium text-muted">
                          Expected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={toggleCheckInForm}>
                        <input type="hidden" name="registrationId" value={r.id} />
                        <input type="hidden" name="nextChecked" value={isIn ? "0" : "1"} />
                        <button
                          type="submit"
                          className={
                            isIn
                              ? "rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
                              : "rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:opacity-90"
                          }
                        >
                          {isIn ? "Undo" : "Check in"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
