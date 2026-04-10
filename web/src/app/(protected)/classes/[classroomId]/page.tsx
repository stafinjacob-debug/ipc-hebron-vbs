import { ClassroomRosterQuickMove } from "@/app/(protected)/classes/classroom-roster-quick-move";
import { auth } from "@/auth";
import { jsonToStringArray } from "@/lib/class-form-field-match";
import { prisma } from "@/lib/prisma";
import { ageForClassroomRule, ageRuleLabel } from "@/lib/class-assignment";
import { canUserViewClassroom } from "@/lib/classroom-access";
import { getEnrollmentCountsByClassroom } from "@/lib/classroom-enrollment";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { classroomId } = await params;
  const canEdit = canManageDirectory(session.user.role);
  const ok = await canUserViewClassroom(session.user.id, session.user.role, classroomId);
  if (!ok) redirect("/classes");

  const c = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: {
      season: true,
      leaderAssignments: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });
  if (!c) notFound();

  const countsMap = await getEnrollmentCountsByClassroom(c.seasonId);
  const ec = countsMap.get(c.id) ?? { seated: 0, waitlisted: 0 };

  const seasonClassrooms = await prisma.classroom.findMany({
    where: { seasonId: c.seasonId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const roster = await prisma.registration.findMany({
    where: {
      classroomId: c.id,
      status: { in: ["PENDING", "CONFIRMED", "DRAFT", "CHECKED_OUT"] },
    },
    include: {
      child: { include: { guardian: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
    },
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
  });

  const waitlist = await prisma.registration.findMany({
    where: { classroomId: c.id, status: "WAITLIST" },
    include: {
      child: { include: { guardian: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
    },
    orderBy: { registeredAt: "asc" },
  });

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const checkedInToday = await prisma.registration.count({
    where: {
      classroomId: c.id,
      checkedInAt: { gte: dayStart, lte: dayEnd },
    },
  });

  const leaders = [...c.leaderAssignments].sort((a, b) => {
    const o = (r: string) => (r === "PRIMARY" ? 0 : r === "ASSISTANT" ? 1 : 2);
    return o(a.role) - o(b.role);
  });

  const cap = c.capacity;
  const seated = ec.seated;
  const pct = cap > 0 ? Math.min(100, Math.round((seated / cap) * 100)) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link href="/classes" className="text-sm font-medium text-brand underline">
          ← Classes
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <p className="mt-1 text-muted">
              {c.season.name} ({c.season.year})
            </p>
            <p className="mt-2 text-sm text-foreground/85">
              <span className="rounded-md bg-brand/10 px-2 py-0.5 font-medium text-brand">
                {c.useAgeRuleForAutoAssign === false
                  ? "Any age (auto-placement)"
                  : `Ages ${c.ageMin}–${c.ageMax}`}
              </span>
              <span className="ml-2 text-muted">· {ageRuleLabel(c.ageRule)}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {seated} / {cap} seats · {pct}% · {ec.waitlisted} waitlisted
              {c.intakeStatus === "CLOSED" ? " · Intake closed" : ""}
              {!c.isActive ? " · Class inactive" : ""}
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/classes/${c.id}/edit`}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
              >
                Edit class
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-foreground">Overview</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Room</dt>
            <dd>{c.room ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Check-in label</dt>
            <dd>{c.checkInLabel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Badge name</dt>
            <dd>{c.badgeDisplayName ?? c.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Match priority</dt>
            <dd className="tabular-nums">{c.sortOrder}</dd>
          </div>
          <div>
            <dt className="text-muted">Age for auto-assign</dt>
            <dd>{c.useAgeRuleForAutoAssign === false ? "Off (any age)" : `On (${c.ageMin}–${c.ageMax})`}</dd>
          </div>
          {c.matchFormFieldKey?.trim() && c.matchFormFieldValues != null ? (
            <div className="sm:col-span-2">
              <dt className="text-muted">Auto-assign form rule</dt>
              <dd>
                Field <code className="rounded bg-foreground/10 px-1">{c.matchFormFieldKey}</code> must
                be one of:{" "}
                {jsonToStringArray(c.matchFormFieldValues).join(", ") || "—"}
              </dd>
            </div>
          ) : null}
          {c.description ? (
            <div className="sm:col-span-2">
              <dt className="text-muted">Description</dt>
              <dd className="whitespace-pre-wrap">{c.description}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-foreground">Leaders</h2>
        {leaders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No leaders assigned.</p>
        ) : (
          <ul className="mt-3 divide-y divide-foreground/10">
            {leaders.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <span className="font-medium text-foreground">
                  {a.user.name?.trim() || a.user.email}
                </span>
                <span className="ml-2 text-muted">· {a.role.replace("_", " ")}</span>
                <div className="text-xs text-muted">{a.user.email}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="roster" className="scroll-mt-24 rounded-xl border border-foreground/10 bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-foreground">Roster ({roster.length})</h2>
        {roster.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No students assigned to this class yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Check-in</th>
                  <th className="py-2 pr-3 font-medium">Guardian</th>
                  {canEdit ? <th className="py-2 font-medium">Move</th> : null}
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => {
                  const ch = r.child;
                  const g = ch.guardian;
                  const age = ageForClassroomRule(
                    ch.dateOfBirth,
                    c.ageRule,
                    r.registeredAt,
                    c.season.startDate,
                  );
                  return (
                    <tr key={r.id} className="border-t border-foreground/10">
                      <td className="py-2 pr-3">
                        <div className="font-medium">
                          {ch.firstName} {ch.lastName}
                        </div>
                        <div className="text-xs text-muted">
                          Age ~{age}
                          {ch.allergiesNotes ? (
                            <span className="ml-2 font-medium text-amber-800 dark:text-amber-200">
                              Medical / allergy note
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{r.status}</td>
                      <td className="py-2 pr-3">
                        {r.checkedInAt ? (
                          <span className="text-emerald-700 dark:text-emerald-300">In</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted">
                        {g.firstName} {g.lastName}
                        <div className="text-xs">{g.email ?? g.phone ?? "—"}</div>
                      </td>
                      {canEdit ? (
                        <td className="py-2 align-top">
                          <ClassroomRosterQuickMove
                            registrationId={r.id}
                            currentClassroomId={c.id}
                            seasonClassrooms={seasonClassrooms}
                          />
                        </td>
                      ) : null}
                      <td className="py-2">
                        <Link
                          href={`/registrations/${r.id}`}
                          className="text-brand underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-foreground">Waitlist ({waitlist.length})</h2>
        {waitlist.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No waitlisted students in this class.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {waitlist.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-2 first:border-0 first:pt-0"
              >
                <span>
                  {r.child.firstName} {r.child.lastName}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit ? (
                    <ClassroomRosterQuickMove
                      registrationId={r.id}
                      currentClassroomId={c.id}
                      seasonClassrooms={seasonClassrooms}
                    />
                  ) : null}
                  <Link href={`/registrations/${r.id}`} className="text-brand underline">
                    Open registration
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-foreground">Attendance (today)</h2>
        <p className="mt-2 text-sm text-foreground/80">
          {checkedInToday} checked in of {seated} seated registrations (local day).
        </p>
        <p className="mt-1 text-xs text-muted">
          Use the Check-In module for live arrival updates; this summary refreshes when you reload.
        </p>
      </section>
    </div>
  );
}
