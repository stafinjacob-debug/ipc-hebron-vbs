import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";
import { AlertTriangle, School } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const classrooms = await prisma.classroom.findMany({
    where: { season: { isActive: true } },
    orderBy: [{ season: { year: "desc" } }, { name: "asc" }],
    include: {
      season: { select: { name: true, year: true } },
      _count: {
        select: {
          registrations: { where: { status: { not: "CANCELLED" } } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <School className="size-7 text-brand" aria-hidden />
          Classes
        </h1>
        <p className="mt-1 text-muted">
          Live enrollment vs. capacity for each active VBS season. Season and class records are managed from{" "}
          <Link href="/seasons" className="font-medium text-brand underline">
            VBS seasons
          </Link>
          .
        </p>
      </div>

      {classrooms.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated px-6 py-10 text-center">
          <p className="font-medium text-foreground">No classes for active seasons</p>
          <p className="mt-2 text-sm text-muted">
            Create seasons and classrooms so you can assign students and track capacity.
          </p>
          <Link
            href="/seasons"
            className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            View VBS seasons
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {classrooms.map((c) => {
            const n = c._count.registrations;
            const cap = c.capacity;
            const pct = cap > 0 ? Math.min(100, Math.round((n / cap) * 100)) : 0;
            const isFull = cap > 0 && n >= cap;
            const isNear = !isFull && pct >= 80;
            return (
              <li
                key={c.id}
                className="rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-sm text-muted">
                      {c.season.name} ({c.season.year}) · Ages {c.ageMin}–{c.ageMax}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isFull && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
                        <AlertTriangle className="size-3.5" />
                        Full
                      </span>
                    )}
                    {isNear && (
                      <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                        Near capacity
                      </span>
                    )}
                    {!isFull && !isNear && (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                        Open
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>
                      {n} enrolled / {cap} seats
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isFull
                          ? "bg-red-500/80"
                          : isNear
                            ? "bg-amber-500/80"
                            : "bg-brand"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
